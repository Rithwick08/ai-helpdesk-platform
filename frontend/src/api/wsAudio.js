/**
 * wsAudio.js — WebSocket-based streaming audio session manager.
 *
 * Replaces the "record then upload" flow with a persistent WebSocket
 * that streams MediaRecorder timeslice chunks to the backend in real-time.
 *
 * Protocol:
 *   1. Open WS to /ws/assistant/audio
 *   2. Send JSON init: { token, conversation_id, mime_type }
 *   3. Receive JSON: { type: "ready" }
 *   4. Stream BINARY audio chunks while recording
 *   5. Send JSON: { type: "stop" }
 *   6. Receive JSON: { type: "transcript", transcript }
 *   7. Receive JSON: { type: "response", response, status, action_card, conversation_id }
 *
 * Fallback:
 *   If the WebSocket fails to connect or encounters an error,
 *   the caller is notified via onFallback() and should switch to
 *   POST /assistant/transcribe + POST /assistant/chat.
 *
 * Usage:
 *   const session = createWsAudioSession({ token, conversationId, onTranscript,
 *                                          onResponse, onError, onFallback })
 *   await session.start()     // opens WS, acquires mic
 *   session.stop()            // stops recording, triggers transcription + response
 *   session.destroy()         // cleanup without transcribing
 */

const WS_URL = '/ws/assistant/audio'

// How often MediaRecorder fires ondataavailable (ms)
const TIMESLICE_MS = 250

/**
 * @typedef {Object} WsAudioSession
 * @property {() => Promise<void>} start  - Open WS + start recording
 * @property {() => void}          stop   - Stop recording, trigger transcription
 * @property {() => void}          destroy - Cleanup without sending stop
 */

/**
 * Create a WebSocket audio session.
 *
 * @param {Object}   opts
 * @param {string}   opts.token            - JWT auth token
 * @param {number|null} opts.conversationId - existing conversation ID or null
 * @param {function} opts.onTranscript     - called with (transcript: string)
 * @param {function} opts.onResponse       - called with (responsePayload: object)
 * @param {function} opts.onError          - called with (errorMessage: string)
 * @param {function} opts.onFallback       - called when WS is unavailable
 * @returns {WsAudioSession}
 */
export function createWsAudioSession({
  token,
  conversationId,
  onTranscript,
  onResponse,
  onError,
  onFallback,
}) {
  let ws        = null
  let recorder  = null
  let stream    = null
  let mimeType  = 'audio/webm'
  let ready     = false
  let destroyed = false

  // ── Choose MIME type ────────────────────────────────────────────────────────
  function chooseMime() {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported('audio/webm'))             return 'audio/webm'
    return 'audio/ogg'
  }

  // ── Open WebSocket and handshake ────────────────────────────────────────────
  async function openSocket() {
    return new Promise((resolve, reject) => {
      // Build full WS URL — relative path works via Vite proxy
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const host  = window.location.host
      const url   = `${proto}://${host}${WS_URL}`

      ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'

      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WS connection timeout'))
      }, 5000)

      ws.onopen = () => {
        clearTimeout(timeout)
        // Send auth + session init
        ws.send(JSON.stringify({
          token,
          conversation_id: conversationId ?? null,
          mime_type: mimeType,
        }))
      }

      ws.onmessage = (event) => {
        // Init phase: wait for "ready"
        if (!ready) {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'ready') {
              ready = true
              resolve()
            } else if (msg.type === 'error') {
              reject(new Error(msg.message || 'WS init error'))
            }
          } catch {
            reject(new Error('Invalid WS init response'))
          }
          return
        }

        // Streaming phase: handle server messages
        _handleServerMessage(event.data)
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('WebSocket connection error'))
      }

      ws.onclose = (event) => {
        clearTimeout(timeout)
        ready = false
        if (!destroyed) {
          // Unexpected close
          console.warn('[wsAudio] WebSocket closed unexpectedly:', event.code, event.reason)
        }
      }
    })
  }

  // ── Handle server messages during streaming phase ───────────────────────────
  function _handleServerMessage(data) {
    try {
      const msg = JSON.parse(data)
      switch (msg.type) {
        case 'transcript':
          onTranscript?.(msg.transcript)
          break
        case 'response':
          onResponse?.(msg)
          break
        case 'error':
          onError?.(msg.message || 'An error occurred.')
          break
        default:
          break
      }
    } catch {
      console.warn('[wsAudio] Could not parse server message:', data)
    }
  }

  // ── Acquire microphone + start MediaRecorder ────────────────────────────────
  async function startMic() {
    stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
    mimeType = chooseMime()
    recorder = new MediaRecorder(stream, { mimeType })

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
        // Stream chunk as binary over the WebSocket
        ws.send(e.data)
      }
    }

    recorder.start(TIMESLICE_MS)   // fire ondataavailable every TIMESLICE_MS
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Open the WebSocket, authenticate, and start streaming audio.
   * If the WS connection fails, onFallback() is called.
   */
  async function start() {
    if (destroyed) return
    try {
      mimeType = chooseMime()
      await openSocket()
      await startMic()
    } catch (err) {
      console.error('[wsAudio] start() failed:', err)
      _cleanup()
      onFallback?.()
    }
  }

  /**
   * Stop the MediaRecorder, flush remaining chunks, and send the "stop" signal.
   * The server will transcribe the audio and return a response.
   */
  function stop() {
    if (!recorder || recorder.state === 'inactive') return

    // recorder.stop() fires one final ondataavailable, then onstop
    recorder.onstop = () => {
      _stopMicTracks()
      // Signal end-of-utterance to the server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }))
      }
    }
    recorder.stop()
  }

  /**
   * Immediately destroy the session without sending audio.
   * Call this when the user cancels or navigates away.
   */
  function destroy() {
    destroyed = true
    _cleanup()
  }

  function _cleanup() {
    try { recorder?.state !== 'inactive' && recorder?.stop() } catch {}
    _stopMicTracks()
    try { ws?.close() } catch {}
    recorder = null
    ws       = null
    stream   = null
    ready    = false
  }

  function _stopMicTracks() {
    stream?.getTracks().forEach(t => t.stop())
    stream = null
  }

  return { start, stop, destroy }
}

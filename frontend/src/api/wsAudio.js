/**
 * wsAudio.js — VoiceSession singleton managing audio recording, WS session, VAD and Barge-in.
 */

import SpeechService from '../services/SpeechService'

const WS_URL = '/ws/assistant/audio'
const TIMESLICE_MS = 100

// VAD Thresholds
const SILENCE_THRESHOLD = 0.015
const SILENCE_DURATION_MS = 700
const MIN_SPEECH_MS = 150
const BARGE_THRESHOLD = 0.020
const BARGE_CONTINUOUS_MS = 50
const MAX_SILENCE_WAIT_MS = 15000

export const VoiceState = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
}

class VoiceSessionManager {
  constructor() {
    this.state = VoiceState.IDLE
    this.audioContext = null
    this.analyser = null
    this.stream = null
    this.recorder = null
    this.ws = null
    this.rafId = null

    // Guards
    this.isRecording = false

    // State Variables
    this.initialized = false
    this.ready = false
    this.destroyed = false
    this.chunkCount = 0
    this.aiSpeechStartTime = 0

    // VAD Tracking Variables
    this.speechDetected = false
    this.speechStartedAt = 0
    this.lastSpeechAt = 0
    this.silenceStartedAt = 0
    this.bargeSpeechStart = null

    this.mimeType = 'audio/webm'

    this.uiCallbacks = {
      onStateChange: null,
      onTranscript: null,
      onResponse: null,
      onError: null,
    }

    this._handleSpeechFinished = this._handleSpeechFinished.bind(this)
  }

  async _lazyInit() {
    if (this.initialized) return
    this.initialized = true

    // Subscribe to SpeechService natural finish events exactly once
    SpeechService.onFinished(this._handleSpeechFinished)

    // 1. Create AudioContext exactly once
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    this.audioContext = new AudioContextClass()

    // 2. Acquire microphone stream exactly once
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    })

    // 3. Create AnalyserNode exactly once
    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.3
    source.connect(this.analyser)

    // 4. Create MediaRecorder exactly once
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      this.mimeType = 'audio/webm;codecs=opus'
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      this.mimeType = 'audio/webm'
    } else {
      this.mimeType = 'audio/ogg'
    }

    console.log(`[wsAudio] Creating MediaRecorder exactly once. MimeType: ${this.mimeType}`)
    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType })

    this.recorder.onstart = () => {
      console.log('[wsAudio] MediaRecorder.onstart fired! State:', this.recorder.state)
    }

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (this.state === VoiceState.LISTENING || this.state === VoiceState.PROCESSING) {
          this.chunkCount++
          this.ws.send(e.data)
        }
      }
    }

    this.recorder.onstop = () => {
      this.opts?.onVadEvent?.('Recording stopped')
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'stop' }))
      }
    }
  }

  _transition(nextState, event, action = null) {
    const oldState = this.state
    if (oldState === nextState) return

    this.state = nextState

    console.log(`\nSTATE:\n${oldState} -> ${nextState}\n\nEVENT:\n${event}\n\nACTION:\n${action || 'none'}\n-----------------------------`)

    // Notify UI state changes
    if (this.uiCallbacks.onStateChange) {
      this.uiCallbacks.onStateChange(nextState)
    }

    this._handleStateEntry(nextState, oldState)
  }

  _handleStateEntry(state, oldState) {
    switch (state) {
      case VoiceState.LISTENING:
        this._startRecording()
        break
      case VoiceState.PROCESSING:
        console.log('Processing')
        this._stopRecording()
        break
      case VoiceState.SPEAKING:
        console.log('AI speaking')
        this.aiSpeechStartTime = performance.now()
        break
      case VoiceState.IDLE:
        this._cleanupSession()
        break
    }
  }

  async handleOrbTap(opts) {
    const currentState = this.state

    if (currentState === VoiceState.IDLE) {
      // Save metadata & UI presentation listeners
      this.token = opts.token
      this.conversationId = opts.conversationId
      this.opts = opts
      this.uiCallbacks = {
        onStateChange: opts.onStateChange,
        onTranscript: opts.onTranscript,
        onResponse: opts.onResponse,
        onError: opts.onError,
      }

      this._transition(VoiceState.LISTENING, 'ORB_TAP', 'startRecording()')
    } else if (currentState === VoiceState.LISTENING) {
      // Exit voice mode entirely
      this._transition(VoiceState.IDLE, 'ORB_TAP', 'stopRecording() & cleanup')
    } else if (currentState === VoiceState.SPEAKING) {
      // Barge-in: Interrupt TTS and go straight to listening again
      SpeechService.stop()
      this._transition(VoiceState.LISTENING, 'ORB_TAP', 'startRecording() immediately')
    } else if (currentState === VoiceState.PROCESSING) {
      // Exit voice mode entirely (tap during processing)
      this._transition(VoiceState.IDLE, 'ORB_TAP', 'cleanup')
    }
  }

  async _startRecording() {
    try {
      await this._lazyInit()
      if (this.state !== VoiceState.LISTENING) return

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      console.log('[wsAudio] Connecting socket...')
      await this._connectSocket()
      if (this.state !== VoiceState.LISTENING) return
      console.log('[wsAudio] Socket connected!')
      this._startRafLoop()

      this.chunkCount = 0
      this.speechDetected = false
      this.speechStartedAt = 0
      this.lastSpeechAt = 0
      this.silenceStartedAt = null
      this.bargeSpeechStart = null

      console.log('[wsAudio] Checking MediaRecorder state before starting:', this.recorder.state)
      if (this.recorder.state === 'inactive') {
        console.log('Recording started')
        this.opts?.onVadEvent?.('Recording started')
        this.recorder.start(TIMESLICE_MS)
        console.log('[wsAudio] Called this.recorder.start(' + TIMESLICE_MS + ')')
      } else {
        console.log('[wsAudio] MediaRecorder was NOT inactive. Cannot start. State:', this.recorder.state)
      }
    } catch (err) {
      console.error('[wsAudio] Failed to start recording:', err)
      this.uiCallbacks.onError?.(err.message || 'Failed to start recording')
      this._transition(VoiceState.IDLE, 'RECORDING_ERROR', 'cleanup')
    }
  }

  _stopRecording() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }
  }

  _handleSpeechFinished({ interrupted }) {
    if (this.state === VoiceState.SPEAKING) {
      if (!interrupted) {
        // AI finished speaking naturally -> listening loop continues
        this._transition(VoiceState.LISTENING, 'AI_FINISHED', 'startRecording()')
      }
    }
  }

  _startRafLoop() {
    if (this.rafId) return

    const bufLen = this.analyser.frequencyBinCount
    const data = new Float32Array(bufLen)

    const tick = () => {
      if (this.destroyed) return

      this.analyser.getFloatTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < bufLen; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / bufLen)

      const now = performance.now()
      const isSpeech = rms > SILENCE_THRESHOLD

      if (this.state === VoiceState.LISTENING) {
        // Absolute timeout check
        if (!this.speechDetected && this.silenceStartedAt === null) {
          this.silenceStartedAt = now
        }
        if (!this.speechDetected && this.silenceStartedAt !== null && (now - this.silenceStartedAt >= MAX_SILENCE_WAIT_MS)) {
          console.log('[wsAudio] Max silence timeout reached')
          this._transition(VoiceState.IDLE, 'TIMEOUT', 'cleanup')
          return
        }

        // VAD analysis
        if (isSpeech) {
          if (!this.speechDetected) {
            this.speechDetected = true
            this.speechStartedAt = now
            console.log('Speech detected')
            this.opts?.onVadEvent?.('Speech detected')
          }
          this.lastSpeechAt = now
          this.silenceStartedAt = null
        } else {
          if (this.speechDetected) {
            if (this.silenceStartedAt === null) {
              this.silenceStartedAt = now
              console.log('Last speech detected')
              this.opts?.onVadEvent?.('Last speech detected')
            }

            const silenceDuration = now - this.silenceStartedAt
            const speechDuration = this.lastSpeechAt - this.speechStartedAt

            if (silenceDuration >= SILENCE_DURATION_MS) {
              if (speechDuration >= MIN_SPEECH_MS) {
                console.log('Silence detected')
                this.opts?.onVadEvent?.('Silence detected')
                this._transition(VoiceState.PROCESSING, 'SILENCE_DETECTED', 'stopRecording()')
              } else {
                console.log('[wsAudio] VAD Reset: Speech too short (' + speechDuration + 'ms)')
                this.speechDetected = false
                this.speechStartedAt = 0
                this.lastSpeechAt = 0
                this.silenceStartedAt = null
              }
            }
          }
        }
      }

      this.rafId = requestAnimationFrame(tick)
    }

    this.rafId = requestAnimationFrame(tick)
  }

  _stopRafLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  async _connectSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return
    }
    return new Promise((resolve, reject) => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const host = window.location.host
      const url = `${proto}://${host}${WS_URL}`

      this.ws = new WebSocket(url)
      this.ws.binaryType = 'arraybuffer'

      const timeout = setTimeout(() => {
        this.ws.close()
        reject(new Error('WS connection timeout'))
      }, 5000)

      this.ws.onopen = () => {
        clearTimeout(timeout)
        this.ws.send(JSON.stringify({
          token: this.token,
          conversation_id: this.conversationId ?? null,
          mime_type: this.mimeType,
        }))
      }

      this.ws.onmessage = (event) => {
        if (!this.ready) {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'ready') {
              this.ready = true
              resolve()
            } else if (msg.type === 'error') {
              reject(new Error(msg.message || 'WS init error'))
            }
          } catch {
            reject(new Error('Invalid WS init response'))
          }
          return
        }
        this._handleServerMessage(event.data)
      }

      this.ws.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('WebSocket connection error'))
      }

      this.ws.onclose = (event) => {
        clearTimeout(timeout)
        this.ready = false
        if (!this.destroyed) {
          console.warn('[wsAudio] WebSocket closed unexpectedly:', event.code, event.reason)
        }
      }
    })
  }

  _handleServerMessage(data) {
    try {
      const msg = JSON.parse(data)
      switch (msg.type) {
        case 'transcript':
          this.uiCallbacks.onTranscript?.(msg.transcript)
          break
        case 'response':
          this.uiCallbacks.onResponse?.(msg)
          if (msg.conversation_id) this.conversationId = msg.conversation_id

          // Transition: PROCESSING -> SPEAKING
          this._transition(VoiceState.SPEAKING, 'RESPONSE_RECEIVED', 'SpeechService.play()')
          SpeechService.play(msg.response)
          break
        case 'error':
          this.uiCallbacks.onError?.(msg.message || 'An error occurred.')
          this._transition(VoiceState.IDLE, 'SERVER_ERROR', 'cleanup')
          break
        default:
          break
      }
    } catch {
      console.warn('[wsAudio] Could not parse server message:', data)
    }
  }

  speakText(text) {
    // Allows text mode to trigger TTS through VoiceSessionManager safely
    this._transition(VoiceState.SPEAKING, 'TEXT_CHAT_SEND', 'SpeechService.play()')
    SpeechService.play(text)
  }

  _cleanupSession() {
    this.isStreaming = false
    this.ready = false

    // Stop MediaRecorder
    try {
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.stop()
      }
    } catch { }

    // Cancel requestAnimationFrame loop
    this._stopRafLoop()

    // Suspend AudioContext instead of closing
    try {
      if (this.audioContext && this.audioContext.state !== 'suspended') {
        this.audioContext.suspend()
      }
    } catch { }

    // Close WebSocket
    try {
      this.ws?.close()
    } catch { }
    this.ws = null
  }

  deactivate() {
    this._transition(VoiceState.IDLE, 'PAGE_UNMOUNT', 'cleanup')
    this.uiCallbacks = {
      onStateChange: null,
      onTranscript: null,
      onResponse: null,
      onError: null,
    }
  }

  destroy() {
    this.destroyed = true
    this.deactivate()
  }
}

export const voiceSession = new VoiceSessionManager()

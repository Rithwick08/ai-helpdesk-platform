/**
 * wsAudio.js — VoiceSession singleton managing audio recording, VAD, and POST /voice/chat pipeline.
 * Uses Deepgram STT -> CyberShield AI -> Sarvam TTS via the unified /voice/chat endpoint.
 */

import { sendVoiceChat } from './assistant'
import SpeechService from '../services/SpeechService'

const SILENCE_THRESHOLD = 0.015
const SILENCE_DURATION_MS = 700
const MIN_SPEECH_MS = 150
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
    this.rafId = null

    this.initialized = false
    this.chunks = []
    this.conversationId = null
    this.sessionId = null

    // VAD Tracking Variables
    this.speechDetected = false
    this.speechStartedAt = 0
    this.lastSpeechAt = 0
    this.silenceStartedAt = null

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

    SpeechService.onFinished(this._handleSpeechFinished)

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    this.audioContext = new AudioContextClass()

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    })

    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.3
    source.connect(this.analyser)

    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      this.mimeType = 'audio/webm;codecs=opus'
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      this.mimeType = 'audio/webm'
    } else {
      this.mimeType = 'audio/ogg'
    }

    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType })

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data)
      }
    }

    this.recorder.onstop = () => {
      this._submitAudioPayload()
    }
  }

  _transition(nextState, event = '', action = null) {
    const oldState = this.state
    if (oldState === nextState) return

    this.state = nextState
    console.log(`[VoiceSession] ${oldState} -> ${nextState} (${event})`)

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
        this._stopRecording()
        break
      case VoiceState.SPEAKING:
        break
      case VoiceState.IDLE:
        this._cleanupSession()
        break
    }
  }

  async handleOrbTap(opts) {
    const currentState = this.state

    if (currentState === VoiceState.IDLE) {
      this.conversationId = opts.conversationId || this.conversationId
      this.opts = opts
      this.uiCallbacks = {
        onStateChange: opts.onStateChange,
        onTranscript: opts.onTranscript,
        onResponse: opts.onResponse,
        onError: opts.onError,
      }

      this._transition(VoiceState.LISTENING, 'ORB_TAP')
    } else if (currentState === VoiceState.LISTENING) {
      // Tap while listening -> stop & process recording
      if (this.speechDetected || this.chunks.length > 0) {
        this._transition(VoiceState.PROCESSING, 'ORB_TAP_SUBMIT')
      } else {
        this._transition(VoiceState.IDLE, 'ORB_TAP_CANCEL')
      }
    } else if (currentState === VoiceState.SPEAKING) {
      // Barge-in: Interrupt TTS and go straight to listening
      SpeechService.stop()
      this._transition(VoiceState.LISTENING, 'ORB_TAP_BARGE_IN')
    } else if (currentState === VoiceState.PROCESSING) {
      this._transition(VoiceState.IDLE, 'ORB_TAP_CANCEL')
    }
  }

  async _startRecording() {
    try {
      await this._lazyInit()
      if (this.state !== VoiceState.LISTENING) return

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.chunks = []
      this.speechDetected = false
      this.speechStartedAt = 0
      this.lastSpeechAt = 0
      this.silenceStartedAt = null

      if (this.recorder.state === 'inactive') {
        this.recorder.start(100)
        this._startRafLoop()
      }
    } catch (err) {
      console.error('[VoiceSession] Failed to start recording:', err)
      this.uiCallbacks.onError?.(err.message || 'Failed to access microphone')
      this._transition(VoiceState.IDLE, 'RECORDING_ERROR')
    }
  }

  _stopRecording() {
    this._stopRafLoop()
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }
  }

  async _submitAudioPayload() {
    if (this.chunks.length === 0) {
      this._transition(VoiceState.IDLE, 'NO_AUDIO_CHUNKS')
      return
    }

    const audioBlob = new Blob(this.chunks, { type: this.mimeType })
    this.chunks = []

    if (audioBlob.size < 500) {
      console.warn('[VoiceSession] Audio payload too small, ignoring.')
      this._transition(VoiceState.IDLE, 'AUDIO_TOO_SMALL')
      return
    }

    try {
      console.log(`[VoiceSession] Sending audio payload to /voice/chat (${audioBlob.size} bytes)...`)
      const res = await sendVoiceChat(audioBlob, this.conversationId, this.sessionId)

      if (res.conversation_id) this.conversationId = res.conversation_id
      if (res.session_id) this.sessionId = res.session_id

      if (res.transcript) {
        this.uiCallbacks.onTranscript?.(res.transcript)
      }

      this.uiCallbacks.onResponse?.({
        response: res.response_text,
        conversation_id: res.conversation_id,
        status: res.agent_status,
      })

      // Transition to SPEAKING and play Sarvam AI TTS audio
      this._transition(VoiceState.SPEAKING, 'RESPONSE_RECEIVED')
      SpeechService.play(res.response_text, res.audio_url)

    } catch (err) {
      console.error('[VoiceSession] Pipeline error:', err)
      const detail = err.response?.data?.detail || err.message || 'Voice pipeline error'
      this.uiCallbacks.onError?.(detail)
      this._transition(VoiceState.IDLE, 'PIPELINE_ERROR')
    }
  }

  _handleSpeechFinished({ interrupted }) {
    if (this.state === VoiceState.SPEAKING) {
      if (!interrupted) {
        // Voice finish naturally -> return to IDLE
        this._transition(VoiceState.IDLE, 'AI_FINISHED')
      }
    }
  }

  _startRafLoop() {
    if (this.rafId) return
    const bufLen = this.analyser.frequencyBinCount
    const data = new Float32Array(bufLen)

    const tick = () => {
      if (this.state !== VoiceState.LISTENING) return

      this.analyser.getFloatTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < bufLen; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / bufLen)

      const now = performance.now()
      const isSpeech = rms > SILENCE_THRESHOLD

      if (!this.speechDetected && this.silenceStartedAt === null) {
        this.silenceStartedAt = now
      }
      if (!this.speechDetected && this.silenceStartedAt !== null && (now - this.silenceStartedAt >= MAX_SILENCE_WAIT_MS)) {
        console.log('[VoiceSession] Max silence timeout reached')
        this._transition(VoiceState.IDLE, 'TIMEOUT')
        return
      }

      if (isSpeech) {
        if (!this.speechDetected) {
          this.speechDetected = true
          this.speechStartedAt = now
        }
        this.lastSpeechAt = now
        this.silenceStartedAt = null
      } else {
        if (this.speechDetected) {
          if (this.silenceStartedAt === null) {
            this.silenceStartedAt = now
          }

          const silenceDuration = now - this.silenceStartedAt
          const speechDuration = this.lastSpeechAt - this.speechStartedAt

          if (silenceDuration >= SILENCE_DURATION_MS) {
            if (speechDuration >= MIN_SPEECH_MS) {
              console.log('[VoiceSession] VAD Silence detected -> submit')
              this._transition(VoiceState.PROCESSING, 'VAD_SILENCE')
              return
            } else {
              this.speechDetected = false
              this.speechStartedAt = 0
              this.lastSpeechAt = 0
              this.silenceStartedAt = null
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

  _cleanupSession() {
    this._stopRafLoop()
    try {
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.stop()
      }
    } catch {}
    try {
      if (this.audioContext && this.audioContext.state !== 'suspended') {
        this.audioContext.suspend()
      }
    } catch {}
  }

  deactivate() {
    this._transition(VoiceState.IDLE, 'DEACTIVATE')
    this.uiCallbacks = {
      onStateChange: null,
      onTranscript: null,
      onResponse: null,
      onError: null,
    }
  }

  destroy() {
    this.deactivate()
  }
}

export const voiceSession = new VoiceSessionManager()

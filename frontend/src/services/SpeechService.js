/**
 * SpeechService.js — Centralized speech playback service.
 *
 * All TTS playback in the application goes through this singleton.
 * Components never call window.speechSynthesis directly.
 *
 * Features
 * --------
 *  - play(text)        — Cancel any current speech, then speak `text`.
 *  - stop()            — Cancel current speech immediately.
 *  - isSpeaking()      — Returns true if speech is currently playing.
 *  - onFinished(fn)    — Register a callback for when speech ends or is stopped.
 *  - offFinished(fn)   — Remove a previously registered callback.
 *
 * Future TTS providers (ElevenLabs, Azure TTS, Google TTS, etc.)
 * only need to replace the internal _speak() implementation.
 * The public API stays identical.
 *
 * Usage
 * -----
 *   import SpeechService from '../services/SpeechService'
 *
 *   SpeechService.onFinished(({ interrupted }) => {
 *     if (!interrupted) startRecording()
 *   })
 *
 *   SpeechService.play('Hello, how can I help you today?')
 *   SpeechService.stop()      // barge-in: cancels immediately
 *   SpeechService.isSpeaking() // → boolean
 */

// ── Text cleaning ─────────────────────────────────────────────────────────────
const CLEAN_RE  = /[#✅•⚠️*_~`]/g
const LINK_RE   = /https?:\/\/\S+/g

function _cleanText(raw) {
  return raw
    .replace(CLEAN_RE, '')
    .replace(LINK_RE, 'a link')
    .trim()
}

// ── Internal state ────────────────────────────────────────────────────────────
let _speaking    = false
let _interrupted = false
const _listeners = new Set()   // Set<function>

function _notifyFinished(interrupted) {
  _speaking    = false
  _interrupted = false
  for (const fn of _listeners) {
    try { fn({ interrupted }) } catch (e) { console.error('[SpeechService] listener error', e) }
  }
}

// ── Settings management ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voiceName: '',
}

function getSettings() {
  try {
    const raw = localStorage.getItem('cyberdesk_voice_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        speed: typeof parsed.speed === 'number' ? parsed.speed : DEFAULT_SETTINGS.speed,
        pitch: typeof parsed.pitch === 'number' ? parsed.pitch : DEFAULT_SETTINGS.pitch,
        volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_SETTINGS.volume,
        voiceName: typeof parsed.voiceName === 'string' ? parsed.voiceName : DEFAULT_SETTINGS.voiceName,
      }
    }
  } catch (e) {
    console.error('[SpeechService] Error loading settings', e)
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings) {
  try {
    localStorage.setItem('cyberdesk_voice_settings', JSON.stringify(settings))
  } catch (e) {
    console.error('[SpeechService] Error saving settings', e)
  }
}

function getVoices() {
  if (!window.speechSynthesis) return []
  return window.speechSynthesis.getVoices()
}

// ── Provider — browser Web Speech API (replaceable) ──────────────────────────
function _speak(text, onEnd, onError) {
  const synth    = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)

  // Apply active voice settings
  const settings = getSettings()
  utterance.rate = settings.speed
  utterance.pitch = settings.pitch
  utterance.volume = settings.volume

  if (settings.voiceName) {
    const voices = synth.getVoices()
    const matchingVoice = voices.find(v => v.voiceURI === settings.voiceName)
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }
  }

  utterance.onend = () => {
    performance.mark('speech_end')
    try { performance.measure('speech_duration', 'speech_start', 'speech_end') } catch {}
    onEnd()
  }

  utterance.onerror = (e) => {
    // 'interrupted' is the expected error when stop() is called mid-speech.
    // Treat it as an intentional stop, not a failure.
    if (e.error === 'interrupted' || e.error === 'canceled') {
      onEnd()   // still fires the finished callback so callers can re-arm
    } else {
      onError(e)
    }
  }

  synth.speak(utterance)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Stop any current speech and speak `text`.
 * Calls all onFinished listeners when playback ends.
 *
 * @param {string} text  - Raw text (markdown / URLs cleaned automatically)
 */
function play(text) {
  if (!window.speechSynthesis) return

  // Cancel any in-flight speech without triggering the "interrupted" path
  // in callers — we handle it internally.
  _interrupted = false
  window.speechSynthesis.cancel()
  _speaking = true

  const cleaned = _cleanText(text)
  if (!cleaned) {
    // Nothing to say — still fire finished so callers re-arm correctly
    _notifyFinished(false)
    return
  }

  _speak(
    cleaned,
    () => _notifyFinished(_interrupted),    // onEnd
    (e) => {
      console.error('[SpeechService] speech error', e)
      _notifyFinished(true)                 // treat unrecoverable errors as interrupted
    },
  )
}

/**
 * Immediately cancel ongoing speech.
 * Marks the finish event as "interrupted" so listeners can distinguish
 * a user barge-in from natural speech completion.
 */
function stop() {
  if (!window.speechSynthesis) return
  _interrupted = true
  window.speechSynthesis.cancel()
  // _notifyFinished will be called by utterance.onerror / utterance.onend
  // If for some reason neither fires (e.g., nothing was playing), notify now.
  if (_speaking) {
    // Give the browser one event-loop tick to fire onerror/onend
    setTimeout(() => {
      if (_speaking) _notifyFinished(true)
    }, 50)
  }
}

/**
 * Returns true if speech is currently playing.
 */
function isSpeaking() {
  return _speaking
}

/**
 * Register a callback to be called when speech finishes or is interrupted.
 * Callback signature: ({ interrupted: boolean }) => void
 *  - interrupted: true  → speech was cancelled mid-way (barge-in, stop())
 *  - interrupted: false → speech completed naturally
 */
function onFinished(fn) {
  _listeners.add(fn)
}

/**
 * Remove a previously registered onFinished listener.
 */
function offFinished(fn) {
  _listeners.delete(fn)
}

// ── Singleton export ──────────────────────────────────────────────────────────
const SpeechService = { play, stop, isSpeaking, onFinished, offFinished, getSettings, saveSettings, getVoices }

export default SpeechService


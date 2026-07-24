/**
 * SpeechService.js — Centralized speech playback service.
 *
 * Supports playing high-quality synthesized audio URLs (e.g., Sarvam AI TTS)
 * directly via HTML5 Audio, with smooth fallback to browser Web Speech API.
 */

const CLEAN_RE  = /[#✅•⚠️*_~`]/g
const LINK_RE   = /https?:\/\/\S+/g

function _cleanText(raw) {
  return raw
    .replace(CLEAN_RE, '')
    .replace(LINK_RE, 'a link')
    .trim()
}

// ── Internal state ────────────────────────────────────────────────────────────
let _speaking     = false
let _interrupted  = false
let _currentAudio = null
const _listeners  = new Set()   // Set<function>

function _notifyFinished(interrupted) {
  _speaking    = false
  _interrupted = false
  _currentAudio = null
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

function _speak(text, onEnd, onError) {
  if (!window.speechSynthesis) {
    onEnd()
    return
  }
  const synth     = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)

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
    onEnd()
  }

  utterance.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') {
      onEnd()
    } else {
      onError(e)
    }
  }

  synth.speak(utterance)
}

/**
 * Play speech. If audioUrl (e.g. from Sarvam AI TTS) is provided,
 * play via HTML5 Audio. Otherwise fall back to Web Speech API.
 *
 * @param {string} text
 * @param {string|null} audioUrl
 */
function play(text, audioUrl = null) {
  stop()
  _interrupted = false
  _speaking = true

  // Option A: Play synthesized audio URL (Sarvam AI TTS)
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl)
      _currentAudio = audio
      audio.onended = () => {
        _notifyFinished(_interrupted)
      }
      audio.onerror = (e) => {
        console.error('[SpeechService] Sarvam Audio playback error:', e)
        _notifyFinished(true)
      }
      audio.play().catch(err => {
        console.error('[SpeechService] Audio element play failed:', err)
        _notifyFinished(true)
      })
      return
    } catch (err) {
      console.error('[SpeechService] Failed to initialize HTML5 Audio:', err)
    }
  }

  // Option B: Browser Web Speech API fallback
  const cleaned = _cleanText(text)
  if (!cleaned) {
    _notifyFinished(false)
    return
  }

  _speak(
    cleaned,
    () => _notifyFinished(_interrupted),
    (e) => {
      console.error('[SpeechService] speech error', e)
      _notifyFinished(true)
    },
  )
}

/**
 * Immediately cancel ongoing speech (barge-in / user tap).
 */
function stop() {
  _interrupted = true
  if (_currentAudio) {
    try {
      _currentAudio.pause()
      _currentAudio.currentTime = 0
    } catch {}
    _currentAudio = null
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  if (_speaking) {
    setTimeout(() => {
      if (_speaking) _notifyFinished(true)
    }, 50)
  }
}

function isSpeaking() {
  return _speaking
}

function onFinished(fn) {
  _listeners.add(fn)
}

function offFinished(fn) {
  _listeners.delete(fn)
}

const SpeechService = { play, stop, isSpeaking, onFinished, offFinished, getSettings, saveSettings, getVoices }

export default SpeechService

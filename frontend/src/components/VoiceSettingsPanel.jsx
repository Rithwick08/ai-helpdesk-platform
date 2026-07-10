import { useState, useEffect } from 'react'
import SpeechService from '../services/SpeechService'

export default function VoiceSettingsPanel({ onClose }) {
  const [voices, setVoices] = useState([])
  const [settings, setSettings] = useState({
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voiceName: '',
  })

  // Load active settings and available voices
  useEffect(() => {
    setSettings(SpeechService.getSettings())

    const loadVoices = () => {
      const available = SpeechService.getVoices()
      // Filter for English voices or return all if English not found
      const english = available.filter(v => v.lang.startsWith('en'))
      setVoices(english.length > 0 ? english : available)
    }

    loadVoices()
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  const handleChange = (key, val) => {
    const updated = { ...settings, [key]: val }
    setSettings(updated)
    SpeechService.saveSettings(updated)
  }

  // Preview the voice settings
  const handleTest = () => {
    SpeechService.play("This is a preview of my new voice settings. How does it sound?")
  }

  const handleReset = () => {
    const resetValues = {
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      voiceName: '',
    }
    setSettings(resetValues)
    SpeechService.saveSettings(resetValues)
  }

  return (
    <div className="p-5 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-md overflow-hidden relative">
      {/* Glossy gradient highlight */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)',
          filter: 'blur(16px)',
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-cyan-400">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <span className="text-xs font-bold text-white tracking-wider uppercase">Voice Synthesis Settings</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xs font-medium">
            Close
          </button>
        )}
      </div>

      <div className="space-y-4 text-xs">
        {/* Preferred Voice Select */}
        <div>
          <label className="block text-white/50 mb-1.5 font-medium">Preferred Voice</label>
          <select
            value={settings.voiceName}
            onChange={e => handleChange('voiceName', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/80 outline-none transition-colors focus:border-cyan-500/50"
            style={{ colorScheme: 'dark' }}>
            <option value="">Default System Voice</option>
            {voices.map(voice => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Speed / Rate Slider */}
        <div>
          <div className="flex justify-between text-white/50 mb-1">
            <span>Voice Speed (Rate)</span>
            <span className="font-mono text-cyan-400 font-semibold">{settings.speed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.speed}
            onChange={e => handleChange('speed', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
          />
        </div>

        {/* Pitch Slider */}
        <div>
          <div className="flex justify-between text-white/50 mb-1">
            <span>Voice Pitch</span>
            <span className="font-mono text-purple-400 font-semibold">{settings.pitch.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.pitch}
            onChange={e => handleChange('pitch', parseFloat(e.target.value))}
            className="w-full accent-purple-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
          />
        </div>

        {/* Volume Slider */}
        <div>
          <div className="flex justify-between text-white/50 mb-1">
            <span>Voice Volume</span>
            <span className="font-mono text-emerald-400 font-semibold">{Math.round(settings.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={settings.volume}
            onChange={e => handleChange('volume', parseFloat(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-white/5">
          <button
            onClick={handleTest}
            className="flex-1 py-2 px-3 rounded-xl font-bold bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-white border border-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95 text-center">
            Test Speech
          </button>
          <button
            onClick={handleReset}
            className="py-2 px-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5 transition-all text-center">
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

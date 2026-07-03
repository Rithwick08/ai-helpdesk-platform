import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, ShieldCheck, BrainCircuit, Bell, Palette, Server,
  Save, RefreshCw, CheckCircle2, Activity, Database, Cpu
} from 'lucide-react'

// ── Custom UI Components (shadcn inspired) ───────────────────────────────────

const Card = ({ title, icon: Icon, children, delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl"
  >
    <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
        <Icon size={18} />
      </div>
      <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
    </div>
    <div className="p-6 space-y-6">
      {children}
    </div>
  </motion.div>
)

const Label = ({ children }) => (
  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
    {children}
  </label>
)

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input 
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
  />
)

const Select = ({ value, onChange, options }) => (
  <select 
    value={value}
    onChange={onChange}
    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer appearance-none"
  >
    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
  </select>
)

const Switch = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-semibold text-slate-200">{label}</p>
      {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-cyan-500' : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
)

const Slider = ({ value, onChange, min, max, unit }) => (
  <div className="space-y-3">
    <div className="flex justify-between text-xs text-slate-400 font-bold font-mono">
      <span>{min}{unit}</span>
      <span className="text-cyan-400">{value}{unit}</span>
      <span>{max}{unit}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={e => onChange(e.target.value)}
      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
    />
  </div>
)

// ── Main Page Component ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false)

  // 1. Organization
  const [companyName, setCompanyName] = useState('CyberShield AI')
  const [domain, setDomain] = useState('cybershield.ai')
  const [timezone, setTimezone] = useState('America/New_York')

  // 2. Authentication
  const [passwordPolicy, setPasswordPolicy] = useState('Strict (14+ Chars)')
  const [mfaEnabled, setMfaEnabled] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState(30)

  // 3. AI Config
  const [llmProvider, setLlmProvider] = useState('OpenAI')
  const [model, setModel] = useState('GPT-4 Turbo')
  const [temperature, setTemperature] = useState(0.4)
  const [responseLength, setResponseLength] = useState('Balanced')

  // 4. Notifications
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [incidentAlerts, setIncidentAlerts] = useState(true)
  const [resetAlerts, setResetAlerts] = useState(false)
  const [trainingAlerts, setTrainingAlerts] = useState(true)

  // 5. Appearance
  const [theme, setTheme] = useState('Dark Enterprise')
  const [accentColor, setAccentColor] = useState('Cyan')
  const [animations, setAnimations] = useState(true)

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1000)
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 bg-[#030712]/80 backdrop-blur-xl py-4 border-b border-white/5 -mt-6 lg:-mt-8 mb-8 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Configure workspace, security, and AI preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            Reset Defaults
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2 disabled:opacity-50 w-32 justify-center"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <><Save size={16} /> Save</>}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl">
        
        {/* Left Column */}
        <div className="space-y-8">
          
          {/* Organization */}
          <Card title="Organization Profile" icon={Building2} delay={0.1}>
            <div>
              <Label>Company Name</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Primary Domain</Label>
                <Input value={domain} onChange={e => setDomain(e.target.value)} />
              </div>
              <div>
                <Label>Timezone</Label>
                <Select 
                  value={timezone} 
                  onChange={e => setTimezone(e.target.value)}
                  options={['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'UTC']}
                />
              </div>
            </div>
          </Card>

          {/* Authentication & Security */}
          <Card title="Security & Authentication" icon={ShieldCheck} delay={0.2}>
            <div>
              <Label>Password Policy Strength</Label>
              <Select 
                value={passwordPolicy} 
                onChange={e => setPasswordPolicy(e.target.value)}
                options={['Standard (8+ Chars)', 'Strong (12+ Chars)', 'Strict (14+ Chars)', 'NIST Guidelines']}
              />
            </div>
            
            <div className="pt-2 pb-2">
              <Label>Session Timeout (Minutes)</Label>
              <Slider value={sessionTimeout} onChange={setSessionTimeout} min={5} max={120} unit="m" />
            </div>

            <div className="pt-2 border-t border-white/5">
              <Switch 
                label="Enforce Multi-Factor Auth (MFA)" 
                description="Require all administrative users to use 2FA apps."
                checked={mfaEnabled} 
                onChange={setMfaEnabled} 
              />
            </div>
          </Card>

          {/* AI Configuration */}
          <Card title="AI Model Configuration" icon={BrainCircuit} delay={0.3}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>LLM Provider</Label>
                <Select 
                  value={llmProvider} 
                  onChange={e => setLlmProvider(e.target.value)}
                  options={['OpenAI', 'Anthropic', 'Google', 'Local Model']}
                />
              </div>
              <div>
                <Label>Model Select</Label>
                <Select 
                  value={model} 
                  onChange={e => setModel(e.target.value)}
                  options={['GPT-4 Turbo', 'GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro']}
                />
              </div>
            </div>

            <div className="pt-2">
              <Label>Temperature (Creativity vs Accuracy)</Label>
              <Slider value={temperature} onChange={setTemperature} min={0.0} max={1.0} unit="" />
            </div>

            <div className="pt-2 border-t border-white/5">
              <Label>Default Response Length</Label>
              <Select 
                value={responseLength} 
                onChange={e => setResponseLength(e.target.value)}
                options={['Concise', 'Balanced', 'Detailed', 'Comprehensive']}
              />
            </div>
          </Card>

        </div>

        {/* Right Column */}
        <div className="space-y-8">

          {/* Notifications */}
          <Card title="Notification Preferences" icon={Bell} delay={0.4}>
            <Switch 
              label="Global Email Alerts" 
              description="Send daily summary reports to admin emails."
              checked={emailAlerts} 
              onChange={setEmailAlerts} 
            />
            <Switch 
              label="Critical Incident Alerts" 
              description="Immediate notification on High/Critical severity."
              checked={incidentAlerts} 
              onChange={setIncidentAlerts} 
            />
            <Switch 
              label="Password Reset Approvals" 
              description="Notify when a reset requires manual IT approval."
              checked={resetAlerts} 
              onChange={setResetAlerts} 
            />
            <Switch 
              label="Training Milestone Notifications" 
              description="Alert when departments hit 100% completion."
              checked={trainingAlerts} 
              onChange={setTrainingAlerts} 
            />
          </Card>

          {/* Appearance */}
          <Card title="Appearance & UI" icon={Palette} delay={0.5}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Global Theme</Label>
                <Select 
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  options={['Dark Enterprise', 'Midnight Blue', 'High Contrast Dark']}
                />
              </div>
              <div>
                <Label>Accent Color</Label>
                <Select 
                  value={accentColor} 
                  onChange={e => setAccentColor(e.target.value)}
                  options={['Cyan', 'Blue', 'Emerald', 'Purple', 'Amber']}
                />
              </div>
            </div>
            <div className="pt-4 border-t border-white/5">
              <Switch 
                label="Enable UI Animations" 
                description="Turn off for better performance on older devices."
                checked={animations} 
                onChange={setAnimations} 
              />
            </div>
          </Card>

          {/* System Information */}
          <Card title="System Information" icon={Server} delay={0.6}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              
              <div className="bg-[#1e293b]/50 border border-white/5 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Frontend Version</p>
                <p className="font-mono text-slate-200">v2.4.1-stable</p>
              </div>

              <div className="bg-[#1e293b]/50 border border-white/5 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Backend Version</p>
                <p className="font-mono text-slate-200">v1.18.0-core</p>
              </div>

              <div className="bg-[#1e293b]/50 border border-white/5 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Database</p>
                <p className="font-medium text-slate-200 flex items-center gap-2">
                  <Database size={14} className="text-blue-400" /> PostgreSQL 15
                </p>
              </div>

              <div className="bg-[#1e293b]/50 border border-white/5 p-4 rounded-xl space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">API Status</p>
                  <p className="font-medium text-emerald-400 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 size={14} /> Operational
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">AI Inference</p>
                  <p className="font-medium text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Activity size={14} /> 45ms Latency
                  </p>
                </div>
              </div>

            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}

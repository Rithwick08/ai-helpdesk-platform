import { useState, useRef, useEffect } from 'react'

// ── Icons ─────────────────────────────────────────────────────────────────────
const MicIcon     = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
const BotIcon     = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/><path d="M12 3v4M8 7h8a2 2 0 012 2v2H6V9a2 2 0 012-2z"/></svg>
const SendIcon    = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const LockIcon    = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
const AlertIcon   = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const TicketIcon  = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg>
const ShieldIcon  = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const CheckIcon   = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={cls}><polyline points="20 6 9 17 4 12"/></svg>
const ZapIcon     = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
const ClockIcon   = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const XIcon       = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const RefreshIcon = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>

// ── Demo data ─────────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    id: 'password',
    label: 'Reset Password',
    desc: 'Secure self-service reset',
    icon: LockIcon,
    color: 'accent',
    prompt: 'I need to reset my password.',
  },
  {
    id: 'incident',
    label: 'Report Incident',
    desc: 'Security threat or phishing',
    icon: AlertIcon,
    color: 'red',
    prompt: 'I want to report a security incident.',
  },
  {
    id: 'ticket',
    label: 'IT Support',
    desc: 'Technical issue or outage',
    icon: TicketIcon,
    color: 'amber',
    prompt: 'I need IT support for a technical issue.',
  },
  {
    id: 'security',
    label: 'Security Question',
    desc: 'Policy, guidance & advice',
    icon: ShieldIcon,
    color: 'green',
    prompt: 'I have a security question.',
  },
]

const MY_TICKETS = [
  { id: 'TKT-1042', title: 'VPN disconnects every 10 min', status: 'In Progress', priority: 'High',   created: '2h ago' },
  { id: 'TKT-1038', title: 'Outlook not syncing calendar', status: 'Resolved',    priority: 'Medium', created: '1d ago' },
  { id: 'TKT-1029', title: 'Printer driver installation',  status: 'Closed',      priority: 'Low',    created: '3d ago' },
]

const MY_RESETS = [
  { id: 'PWR-208', account: 'john.doe@corp.com', status: 'Completed', created: '5d ago' },
  { id: 'PWR-191', account: 'jdoe-admin@corp.com', status: 'Pending Verification', created: '8d ago' },
]

const SECURITY_TIPS = [
  { icon: '🔒', tip: 'Enable MFA on all your work accounts today — it blocks 99% of automated attacks.' },
  { icon: '📧', tip: 'Always verify the sender\'s email domain before clicking links. Look for misspelled domains.' },
  { icon: '🔑', tip: 'Use a password manager. Never reuse passwords across work and personal accounts.' },
  { icon: '💻', tip: 'Lock your screen (Win+L / Cmd+Ctrl+Q) every time you step away from your desk.' },
]

// AI response simulator
const AI_RESPONSES = {
  default: [
    { type: 'text', content: 'I\'m here to help! You can ask me to reset your password, report a security incident, create an IT support ticket, or answer any security-related questions.' },
  ],
  password: [
    { type: 'text', content: 'I\'ll start your secure password reset process right now.' },
    { type: 'action', label: 'Password Reset Initiated', detail: 'An OTP has been sent to your registered email john.doe@corp.com · Please enter the code when received · Expires in 10 minutes', status: 'pending' },
  ],
  incident: [
    { type: 'text', content: 'I\'ll create a security incident report immediately. Can you briefly describe what you observed?' },
    { type: 'action', label: 'Incident Report Created', detail: 'INC-00431 · Security Incident · Status: Open · SOC team has been notified · Severity assessment in progress', status: 'success' },
  ],
  ticket: [
    { type: 'text', content: 'I\'ll diagnose your issue and create a support ticket. Please describe the problem you\'re experiencing.' },
    { type: 'action', label: 'IT Ticket Created', detail: 'TKT-1043 · Priority: Medium · AI Diagnosis: Initiating analysis... · Step-by-step fix will be provided shortly', status: 'success' },
  ],
  security: [
    { type: 'text', content: 'Great question! I can provide guidance on security policies, best practices, threat awareness, and compliance. What would you like to know?' },
  ],
  vpn: [
    { type: 'text', content: 'I\'ll diagnose your VPN issue right away.' },
    { type: 'action', label: 'IT Ticket Created', detail: 'TKT-1043 · VPN Connectivity Issue · Priority: High · Diagnosis: MTU mismatch on tunnel interface detected · Recommended fix: Set MTU to 1400 on your VPN adapter settings', status: 'success' },
  ],
  phishing: [
    { type: 'text', content: 'This is serious. I\'m escalating this to your SOC team immediately. Do not click any links in the email.' },
    { type: 'action', label: 'Security Incident Reported', detail: 'INC-00432 · Phishing Attempt · Severity: High · SOC team alerted · Email quarantine request sent to IT gateway', status: 'critical' },
  ],
}

function getAIResponse(text) {
  const t = text.toLowerCase()
  if (t.includes('password') || t.includes('reset'))     return AI_RESPONSES.password
  if (t.includes('phishing') || t.includes('suspicious')) return AI_RESPONSES.phishing
  if (t.includes('incident') || t.includes('attack'))    return AI_RESPONSES.incident
  if (t.includes('vpn'))                                  return AI_RESPONSES.vpn
  if (t.includes('ticket') || t.includes('support') || t.includes('issue') || t.includes('problem')) return AI_RESPONSES.ticket
  if (t.includes('security') || t.includes('policy'))    return AI_RESPONSES.security
  return AI_RESPONSES.default
}

// ── Color map ─────────────────────────────────────────────────────────────────
const C = {
  accent: { text: 'text-[var(--color-soc-accent)]', bg: 'bg-[var(--color-soc-accent-glow)]', border: 'border-[rgba(0,212,255,0.25)]' },
  red:    { text: 'text-[var(--color-soc-red)]',    bg: 'bg-[var(--color-soc-red-glow)]',    border: 'border-[rgba(255,59,92,0.25)]' },
  amber:  { text: 'text-[var(--color-soc-amber)]',  bg: 'bg-[var(--color-soc-amber-glow)]',  border: 'border-[rgba(255,176,32,0.25)]' },
  green:  { text: 'text-[var(--color-soc-green)]',  bg: 'bg-[var(--color-soc-green-glow)]',  border: 'border-[rgba(0,255,136,0.25)]' },
}

const STATUS_STYLE = {
  'In Progress':          'status-warning',
  'Resolved':             'status-active',
  'Closed':               'status-info',
  'Completed':            'status-active',
  'Pending Verification': 'status-warning',
  'Open':                 'status-critical',
}

// ── Waveform bar (decorative) ─────────────────────────────────────────────────
function Waveform({ active }) {
  const heights = [4, 8, 14, 10, 18, 12, 20, 14, 10, 16, 8, 12, 18, 10, 6, 14, 20, 12, 8, 16, 10, 6]
  return (
    <div className="flex items-center justify-center gap-0.5 h-10">
      {heights.map((h, i) => (
        <div key={i}
          className="w-0.5 rounded-full transition-all"
          style={{
            height: active ? `${h}px` : '4px',
            background: 'var(--color-soc-accent)',
            opacity: active ? 0.8 : 0.25,
            animationName: active ? 'pulse-ring' : 'none',
            animationDuration: `${0.5 + (i % 5) * 0.15}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── AI Action Card ────────────────────────────────────────────────────────────
function ActionCard({ label, detail, status }) {
  const statusColor = {
    success:  { bg: 'var(--color-soc-green-glow)', border: 'rgba(0,255,136,0.2)', text: 'var(--color-soc-green)', icon: CheckIcon },
    pending:  { bg: 'var(--color-soc-amber-glow)', border: 'rgba(255,176,32,0.2)', text: 'var(--color-soc-amber)', icon: ClockIcon },
    critical: { bg: 'var(--color-soc-red-glow)',   border: 'rgba(255,59,92,0.2)',  text: 'var(--color-soc-red)',   icon: AlertIcon },
  }
  const s = statusColor[status] || statusColor.success
  const Icon = s.icon
  return (
    <div className="mt-2 p-3 rounded-xl" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon cls="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.text }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.text }}>{label}</span>
      </div>
      <p className="text-[11px] text-[var(--color-soc-text-muted)] leading-relaxed">{detail}</p>
    </div>
  )
}

// ── Main AssistantPage ────────────────────────────────────────────────────────
export default function AssistantPage() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'ai',
      text: 'Hello, John! 👋 I\'m your CyberShield AI assistant. I can help you reset passwords, report security incidents, create IT support tickets, and answer security questions. How can I help you today?',
      actions: [],
      time: 'just now',
    },
  ])
  const [input, setInput]           = useState('')
  const [listening, setListening]   = useState(false)
  const [aiTyping, setAiTyping]     = useState(false)
  const [tipIndex, setTipIndex]     = useState(0)
  const chatEndRef                  = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTyping])

  function sendMessage(text) {
    if (!text.trim() || aiTyping) return
    const userMsg = { id: Date.now(), role: 'user', text: text.trim(), time: 'just now' }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setAiTyping(true)

    setTimeout(() => {
      const responses = getAIResponse(text)
      const aiMessages = responses.map((r, i) => ({
        id: Date.now() + i + 1,
        role: 'ai',
        text: r.type === 'text' ? r.content : null,
        action: r.type === 'action' ? r : null,
        time: 'just now',
      }))
      setMessages((prev) => [...prev, ...aiMessages])
      setAiTyping(false)
    }, 1200)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearChat() {
    setMessages([{
      id: 0,
      role: 'ai',
      text: 'Chat cleared. How can I assist you?',
      actions: [],
      time: 'just now',
    }])
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ══ LEFT: Voice assistant + chat — 2 cols ══ */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* ── Mic / Voice panel ── */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.25)] flex items-center justify-center">
                  <BotIcon cls="w-4 h-4 text-[var(--color-soc-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--color-soc-text)]">CyberShield AI</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={['w-1.5 h-1.5 rounded-full', listening ? 'bg-[var(--color-soc-red)] animate-pulse' : 'bg-[var(--color-soc-green)] animate-pulse'].join(' ')} />
                    <span className={['text-[10px] font-medium', listening ? 'text-[var(--color-soc-red)]' : 'text-[var(--color-soc-green)]'].join(' ')}>
                      {listening ? 'Listening...' : 'Ready · AI Online'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={clearChat}
                title="Clear conversation"
                className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)] transition-colors"
              >
                <RefreshIcon cls="w-4 h-4" />
              </button>
            </div>

            {/* Waveform */}
            <div className="px-6 py-5 bg-[var(--color-soc-surface)] border-b border-[var(--color-soc-border-subtle)]">
              <Waveform active={listening || aiTyping} />
              <p className="text-center text-[10px] text-[var(--color-soc-text-muted)] mt-2 font-mono uppercase tracking-widest">
                {listening ? 'Recording — speak now' : aiTyping ? 'AI processing...' : 'Voice input ready'}
              </p>
            </div>

            {/* Mic button */}
            <div className="flex items-center justify-center gap-6 px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
              <button
                id="mic-button"
                onClick={() => setListening(!listening)}
                className={[
                  'relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200',
                  listening
                    ? 'bg-[var(--color-soc-red)] shadow-[0_0_30px_var(--color-soc-red-glow)]'
                    : 'bg-[var(--color-soc-accent)] shadow-[0_0_20px_var(--color-soc-accent-glow)] hover:shadow-[0_0_35px_var(--color-soc-accent-glow)] hover:scale-105',
                ].join(' ')}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                {listening
                  ? <XIcon cls="w-7 h-7 stroke-[#050b14]" />
                  : <MicIcon cls="w-7 h-7 stroke-[#050b14]" />
                }
                {listening && (
                  <span className="absolute inset-0 rounded-full border-2 border-[var(--color-soc-red)] animate-ping opacity-40" />
                )}
              </button>
              <div className="text-sm text-[var(--color-soc-text-muted)]">
                <p className="font-semibold text-[var(--color-soc-text)]">
                  {listening ? 'Tap to stop' : 'Tap to speak'}
                </p>
                <p className="text-xs mt-0.5">or type below</p>
              </div>
            </div>

            {/* Conversation history */}
            <div className="h-72 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={['flex gap-2.5', msg.role === 'user' ? 'justify-end' : ''].join(' ')}>
                  {msg.role === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.3)] flex items-center justify-center flex-shrink-0 mt-1">
                      <BotIcon cls="w-3 h-3 text-[var(--color-soc-accent)]" />
                    </div>
                  )}
                  <div className="max-w-[85%]">
                    {msg.text && (
                      <div className={[
                        'px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] rounded-tr-sm font-medium'
                          : 'bg-[var(--color-soc-surface)] text-[var(--color-soc-text)] rounded-tl-sm border border-[var(--color-soc-border-subtle)]',
                      ].join(' ')}>
                        {msg.text}
                      </div>
                    )}
                    {msg.action && (
                      <ActionCard label={msg.action.label} detail={msg.action.detail} status={msg.action.status} />
                    )}
                    <p className="text-[9px] text-[var(--color-soc-text-dim)] mt-1 px-1">{msg.time}</p>
                  </div>
                </div>
              ))}

              {aiTyping && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.3)] flex items-center justify-center flex-shrink-0 mt-1">
                    <BotIcon cls="w-3 h-3 text-[var(--color-soc-accent)]" />
                  </div>
                  <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)]">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-accent)] opacity-60"
                          style={{
                            animationName: 'pulse-ring',
                            animationDuration: '1s',
                            animationTimingFunction: 'ease-in-out',
                            animationIterationCount: 'infinite',
                            animationDelay: `${i * 0.2}s`,
                          }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Text input */}
            <div className="px-4 pb-4 pt-2 border-t border-[var(--color-soc-border-subtle)]">
              <div className="flex items-end gap-2">
                <textarea
                  id="chat-input"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your request or click the mic to speak..."
                  className="flex-1 resize-none rounded-xl px-4 py-3 text-sm bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] placeholder:text-[var(--color-soc-text-dim)] outline-none focus:border-[var(--color-soc-accent)] transition-colors"
                  style={{ maxHeight: '120px' }}
                  disabled={aiTyping}
                />
                <button
                  id="send-btn"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || aiTyping}
                  className="w-11 h-11 rounded-xl bg-[var(--color-soc-accent)] flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <SendIcon cls="w-4 h-4 stroke-[#050b14]" />
                </button>
              </div>
              <p className="text-[10px] text-[var(--color-soc-text-dim)] mt-2 px-1">
                Press Enter to send · Shift+Enter for new line · All conversations are encrypted and logged
              </p>
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-soc-text)] mb-1">Quick Actions</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mb-4">Click to send a request to the AI</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map((action) => {
                const c = C[action.color]
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    id={`quick-${action.id}`}
                    onClick={() => sendMessage(action.prompt)}
                    disabled={aiTyping}
                    className={`group flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed ${c.bg} ${c.border}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.text}`}>
                      <Icon cls="w-5 h-5" />
                    </div>
                    <p className={`text-xs font-bold text-center leading-tight ${c.text}`}>{action.label}</p>
                    <p className="text-[10px] text-[var(--color-soc-text-muted)] text-center leading-tight">{action.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ══ RIGHT: My Requests + Security awareness ══ */}
        <div className="flex flex-col gap-5">

          {/* ── My Tickets ── */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TicketIcon cls="w-4 h-4 text-[var(--color-soc-amber)]" />
                <h2 className="text-sm font-bold text-[var(--color-soc-text)]">My IT Tickets</h2>
              </div>
              <span className="text-[10px] text-[var(--color-soc-text-muted)] font-mono">{MY_TICKETS.length} total</span>
            </div>
            <ul className="divide-y divide-[var(--color-soc-border-subtle)]">
              {MY_TICKETS.map((t) => (
                <li key={t.id} className="px-5 py-3.5 hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-[var(--color-soc-text)] leading-snug">{t.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-soc-text-muted)]">
                    <span className="font-mono text-[var(--color-soc-accent)]">{t.id}</span>
                    <span>·</span>
                    <span>{t.priority} priority</span>
                    <span>·</span>
                    <span>{t.created}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── My Password Resets ── */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)] flex items-center gap-2">
              <LockIcon cls="w-4 h-4 text-[var(--color-soc-accent)]" />
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Password Reset Requests</h2>
            </div>
            <ul className="divide-y divide-[var(--color-soc-border-subtle)]">
              {MY_RESETS.map((r) => (
                <li key={r.id} className="px-5 py-3.5 hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono text-[var(--color-soc-accent)]">{r.id}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-soc-text-muted)]">{r.account}</p>
                  <p className="text-[10px] text-[var(--color-soc-text-dim)] mt-0.5">{r.created}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Security Awareness Widget ── */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldIcon cls="w-4 h-4 text-[var(--color-soc-green)]" />
                <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Security Awareness</h2>
              </div>
            </div>

            {/* Security score */}
            <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-soc-border-subtle)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-soc-green)" strokeWidth="3"
                      strokeDasharray="78 22" strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 3px var(--color-soc-green))' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-[var(--color-soc-text)]">78</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--color-soc-text)]">Security Score</p>
                  <p className="text-[11px] text-[var(--color-soc-green)] font-medium mt-0.5">Good · 2 tasks pending</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {['Phishing Test', 'Policy Quiz'].map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-soc-amber-glow)] text-[var(--color-soc-amber)] font-semibold border border-[rgba(255,176,32,0.2)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily tip */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold">Daily Security Tip</p>
                <button
                  onClick={() => setTipIndex((tipIndex + 1) % SECURITY_TIPS.length)}
                  className="text-[10px] text-[var(--color-soc-accent)] hover:underline font-medium"
                >
                  Next tip →
                </button>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-accent-glow)] flex items-center justify-center flex-shrink-0 text-base">
                  {SECURITY_TIPS[tipIndex].icon}
                </div>
                <p className="text-[11px] text-[var(--color-soc-text-muted)] leading-relaxed">
                  {SECURITY_TIPS[tipIndex].tip}
                </p>
              </div>
              <button
                onClick={() => sendMessage('Tell me more about this security tip: ' + SECURITY_TIPS[tipIndex].tip)}
                className="mt-3 w-full py-2 rounded-lg text-[11px] font-semibold text-[var(--color-soc-accent)] border border-[rgba(0,212,255,0.2)] hover:bg-[var(--color-soc-accent-glow)] transition-colors"
              >
                Ask AI about this →
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

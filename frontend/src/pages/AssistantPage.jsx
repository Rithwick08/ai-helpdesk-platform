/**
 * AssistantPage.jsx — Employee AI Voice Assistant
 *
 * Layout:
 *  - Full-screen: glowing orb (cyan→purple ring, like the React Bits "Orb" component)
 *  - Floating chat button at bottom-centre
 *  - Chat panel slides up from bottom when clicked
 *  - Right-side info panel: Quick actions, My Tickets, Security tip
 */

import { useState, useRef, useEffect } from 'react'

// ── Icons ─────────────────────────────────────────────────────────────────────
const MicIcon    = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
const SendIcon   = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const ChatIcon   = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
const XIcon      = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const LockIcon   = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
const AlertIcon  = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const TicketIcon = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg>
const ShieldIcon = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const CheckIcon  = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={cls}><polyline points="20 6 9 17 4 12"/></svg>
const ClockIcon  = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const BotIcon    = ({ cls }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/><path d="M12 3v4M8 7h8a2 2 0 012 2v2H6V9a2 2 0 012-2z"/></svg>

// ── Data ──────────────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: 'password', label: 'Reset Password',   desc: 'Secure self-service',     icon: LockIcon,   color: '#00d4ff', prompt: 'I need to reset my password.' },
  { id: 'incident', label: 'Report Incident',  desc: 'Threat or phishing',      icon: AlertIcon,  color: '#ff3b5c', prompt: 'I want to report a security incident.' },
  { id: 'ticket',   label: 'IT Support',       desc: 'Technical issue',         icon: TicketIcon, color: '#ffb020', prompt: 'I need IT support for a technical issue.' },
  { id: 'security', label: 'Ask Security',     desc: 'Policy & guidance',       icon: ShieldIcon, color: '#00ff88', prompt: 'I have a security question.' },
]

const MY_TICKETS = [
  { id: 'TKT-1042', title: 'VPN disconnects every 10 min', status: 'In Progress', priority: 'High',   created: '2h ago' },
  { id: 'TKT-1038', title: 'Outlook not syncing calendar',  status: 'Resolved',    priority: 'Medium', created: '1d ago' },
  { id: 'TKT-1029', title: 'Printer driver installation',   status: 'Closed',      priority: 'Low',    created: '3d ago' },
]

const SECURITY_TIPS = [
  { icon: '🔒', tip: 'Enable MFA on all work accounts — it blocks 99% of automated attacks.' },
  { icon: '📧', tip: 'Verify the sender email domain before clicking links. Look for typos.' },
  { icon: '🔑', tip: 'Use a password manager. Never reuse passwords across work and personal accounts.' },
  { icon: '💻', tip: 'Lock your screen (Win+L / Cmd+Ctrl+Q) every time you step away.' },
]

const AI_RESPONSES = {
  default:  [{ type: 'text', content: 'I\'m here to help! You can ask me to reset your password, report a security incident, create an IT support ticket, or answer security questions.' }],
  password: [{ type: 'text', content: 'Starting your secure password reset now.' }, { type: 'action', label: 'Password Reset Initiated', detail: 'OTP sent to john.doe@corp.com · Enter the code when received · Expires in 10 minutes', status: 'pending' }],
  incident: [{ type: 'text', content: 'Creating a security incident report immediately. Can you briefly describe what you observed?' }, { type: 'action', label: 'Incident Report Created', detail: 'INC-00431 · Security Incident · Open · SOC team notified · Severity assessment in progress', status: 'success' }],
  ticket:   [{ type: 'text', content: 'I\'ll diagnose your issue and create a support ticket. Describe the problem you\'re experiencing.' }, { type: 'action', label: 'IT Ticket Created', detail: 'TKT-1043 · Priority: Medium · AI Diagnosis in progress · Step-by-step fix incoming', status: 'success' }],
  security: [{ type: 'text', content: 'Great question! I can help with security policies, best practices, threat awareness, and compliance. What would you like to know?' }],
  vpn:      [{ type: 'text', content: 'Diagnosing your VPN issue now.' }, { type: 'action', label: 'IT Ticket Created', detail: 'TKT-1043 · VPN Issue · Priority: High · MTU mismatch detected on tunnel interface · Fix: Set MTU to 1400 in VPN adapter settings', status: 'success' }],
  phishing: [{ type: 'text', content: 'Escalating to your SOC team immediately. Do not click any links in the email.' }, { type: 'action', label: 'Security Incident Reported', detail: 'INC-00432 · Phishing Attempt · Severity: High · SOC alerted · Email quarantine request sent', status: 'critical' }],
}

function getAIResponse(text) {
  const t = text.toLowerCase()
  if (t.includes('password') || t.includes('reset'))       return AI_RESPONSES.password
  if (t.includes('phishing') || t.includes('suspicious'))  return AI_RESPONSES.phishing
  if (t.includes('incident') || t.includes('attack'))      return AI_RESPONSES.incident
  if (t.includes('vpn'))                                    return AI_RESPONSES.vpn
  if (t.includes('ticket') || t.includes('support') || t.includes('issue') || t.includes('problem')) return AI_RESPONSES.ticket
  if (t.includes('security') || t.includes('policy'))      return AI_RESPONSES.security
  return AI_RESPONSES.default
}

const STATUS_STYLE = {
  'In Progress':          'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  'Resolved':             'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  'Closed':               'bg-white/10 text-white/40',
  'Completed':            'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  'Pending Verification': 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  'Open':                 'bg-red-500/20 text-red-300 border border-red-500/30',
}

// ── Orb ───────────────────────────────────────────────────────────────────────
// Inspired by the React Bits "Orb" — a large glowing ring with cyan→purple gradient.
function Orb({ listening, aiTyping }) {
  // Pulse scale: bigger when listening/processing
  const active = listening || aiTyping

  return (
    <div className="relative flex items-center justify-center select-none"
      style={{ width: 380, height: 380 }}>

      {/* Outer ambient glow — largest, softest */}
      <div className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(ellipse at 40% 35%, rgba(0,212,255,0.06) 0%, rgba(120,80,255,0.04) 50%, transparent 75%)',
          filter: 'blur(24px)',
        }}
      />

      {/* Ring itself */}
      <div className="absolute rounded-full"
        style={{
          inset: 20,
          background: 'transparent',
          border: '1.5px solid transparent',
          backgroundImage: 'linear-gradient(#07080f, #07080f), conic-gradient(from 200deg, #00d4ff 0deg, #7850ff 120deg, #a855f7 180deg, #00d4ff 360deg)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: [
            'inset 0 0 80px rgba(0,212,255,0.08)',
            '0 0 60px rgba(0,212,255,0.18)',
            '0 0 120px rgba(120,80,255,0.14)',
            '0 0 200px rgba(120,80,255,0.06)',
          ].join(', '),
          transform: active ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease',
          animation: 'orb-rotate 8s linear infinite',
        }}
      />

      {/* Inner glow arc — top-left bright spot (the "light source") */}
      <div className="absolute rounded-full pointer-events-none"
        style={{
          inset: 20,
          background: 'transparent',
          boxShadow: active
            ? '-40px -40px 90px rgba(0,212,255,0.28), 40px 40px 90px rgba(168,85,247,0.22)'
            : '-40px -40px 80px rgba(0,212,255,0.18), 40px 40px 80px rgba(168,85,247,0.14)',
          borderRadius: '50%',
          transition: 'box-shadow 0.5s ease',
        }}
      />

      {/* Ping rings when active */}
      {active && (
        <>
          <div className="absolute rounded-full border border-[rgba(0,212,255,0.15)] animate-ping"
            style={{ inset: 8, animationDuration: '2s' }} />
          <div className="absolute rounded-full border border-[rgba(120,80,255,0.1)] animate-ping"
            style={{ inset: -12, animationDuration: '2.8s', animationDelay: '0.4s' }} />
        </>
      )}

      {/* Centre — mic button */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* State label */}
        <p className="text-[11px] font-mono tracking-[0.22em] uppercase"
          style={{ color: listening ? '#ff3b5c' : aiTyping ? '#ffb020' : 'rgba(255,255,255,0.35)' }}>
          {listening ? 'Listening...' : aiTyping ? 'Processing...' : 'Awaiting input'}
        </p>

        {/* Mic button — no circle, bare icon */}
        <button
          id="mic-button"
          onClick={() => {}}
          aria-label="Toggle voice input"
          className="relative flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ background: 'none', border: 'none', padding: 0 }}>
          <MicIcon cls="w-8 h-8" style={{
            color: listening ? '#ff3b5c' : 'rgba(0,212,255,0.75)',
            filter: listening
              ? 'drop-shadow(0 0 8px rgba(255,59,92,0.7))'
              : 'drop-shadow(0 0 6px rgba(0,212,255,0.5))',
          }} />
        </button>

        <p className="text-[10px] text-white/25 tracking-wider">tap to speak</p>
      </div>
    </div>
  )
}

// ── Action Card (inside chat) ─────────────────────────────────────────────────
function ActionCard({ label, detail, status }) {
  const s = {
    success:  { bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.2)',  text: '#00ff88', Icon: CheckIcon  },
    pending:  { bg: 'rgba(255,176,32,0.08)', border: 'rgba(255,176,32,0.2)', text: '#ffb020', Icon: ClockIcon  },
    critical: { bg: 'rgba(255,59,92,0.08)',  border: 'rgba(255,59,92,0.2)',  text: '#ff3b5c', Icon: AlertIcon  },
  }[status] || { bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.2)', text: '#00ff88', Icon: CheckIcon }
  const Icon = s.Icon
  return (
    <div className="mt-2 p-3 rounded-xl text-[11px]"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon cls="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.text }} />
        <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: s.text }}>{label}</span>
      </div>
      <p className="text-white/50 leading-relaxed">{detail}</p>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const [chatOpen, setChatOpen]     = useState(false)
  const [messages, setMessages]     = useState([{
    id: 0, role: 'ai',
    text: 'Hello! 👋 I\'m your CyberShield AI assistant. I can reset passwords, report security incidents, create IT tickets, and answer security questions. How can I help?',
    time: 'just now',
  }])
  const [input, setInput]           = useState('')
  const [listening, setListening]   = useState(false)
  const [aiTyping, setAiTyping]     = useState(false)
  const [tipIndex, setTipIndex]     = useState(0)
  const chatEndRef                  = useRef(null)
  const inputRef                    = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTyping])

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [chatOpen])

  function sendMessage(text) {
    if (!text.trim() || aiTyping) return
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: text.trim(), time: 'just now' }])
    setInput('')
    setAiTyping(true)
    setTimeout(() => {
      const responses = getAIResponse(text)
      setMessages(prev => [...prev, ...responses.map((r, i) => ({
        id: Date.now() + i + 1,
        role: 'ai',
        text: r.type === 'text' ? r.content : null,
        action: r.type === 'action' ? r : null,
        time: 'just now',
      }))])
      setAiTyping(false)
    }, 1200)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const unread = 0 // could track new ai messages while chat closed

  return (
    <>
      {/* ── Global orb keyframe ── */}
      <style>{`
        @keyframes orb-rotate {
          from { filter: hue-rotate(0deg); }
          to   { filter: hue-rotate(360deg); }
        }
        @keyframes chat-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* ── Full-height canvas ── */}
      <div className="relative min-h-[calc(100vh-56px)] flex overflow-hidden"
        style={{ background: '#07080f' }}>

        {/* Background star-field gradient */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(0,212,255,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 70% 70%, rgba(120,80,255,0.04) 0%, transparent 60%)',
          }}
        />

        {/* ── LEFT: Orb area (main focus) ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-8">

          {/* Title */}
          <div className="text-center">
            <p className="text-[11px] tracking-[0.35em] uppercase font-medium text-white/30 mb-1">CyberShield</p>
            <h1 className="text-2xl font-black text-white tracking-tight">AI Voice Assistant</h1>
          </div>

          {/* Orb */}
          <Orb listening={listening} aiTyping={aiTyping} />

          {/* Quick action pills */}
          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon
              return (
                <button key={action.id}
                  id={`quick-${action.id}`}
                  onClick={() => { setChatOpen(true); setTimeout(() => sendMessage(action.prompt), 200) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  style={{
                    borderColor: `${action.color}30`,
                    background: `${action.color}10`,
                    color: action.color,
                  }}>
                  <Icon cls="w-3.5 h-3.5 flex-shrink-0" />
                  {action.label}
                </button>
              )
            })}
          </div>

          {/* Hint text */}
          <p className="text-[11px] text-white/20 text-center">
            Tap the orb to speak · Click a pill or the chat button to type
          </p>
        </div>

        {/* ── RIGHT: Info panel ── */}
        <aside className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 p-5 border-l border-white/5 overflow-y-auto">

          {/* My Tickets */}
          <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <TicketIcon cls="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs font-bold text-white">My IT Tickets</span>
              <span className="ml-auto text-[10px] text-white/30 font-mono">{MY_TICKETS.length}</span>
            </div>
            <ul className="divide-y divide-white/5">
              {MY_TICKETS.map(t => (
                <li key={t.id} className="px-4 py-3 hover:bg-white/4 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[11px] font-semibold text-white/80 leading-snug">{t.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-white/30">
                    <span className="text-cyan-400/60 font-mono">{t.id}</span>
                    <span>· {t.priority} · {t.created}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Security awareness */}
          <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <ShieldIcon cls="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-bold text-white">Security Score</span>
            </div>
            <div className="px-4 py-4">
              {/* Score ring */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#00ff88" strokeWidth="3"
                      strokeDasharray="78 22" strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.5))' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white">78</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Good Standing</p>
                  <p className="text-[11px] text-emerald-400 mt-0.5">2 tasks pending</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {['Phishing Test', 'Policy Quiz'].map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Daily tip */}
              <div className="p-3 rounded-xl bg-white/4 border border-white/6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">Daily Tip</p>
                  <button onClick={() => setTipIndex(i => (i + 1) % SECURITY_TIPS.length)}
                    className="text-[9px] text-cyan-400/60 hover:text-cyan-400 transition-colors">
                    Next →
                  </button>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0">{SECURITY_TIPS[tipIndex].icon}</span>
                  <p className="text-[11px] text-white/50 leading-relaxed">{SECURITY_TIPS[tipIndex].tip}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Floating Chat Button ── */}
      {!chatOpen && (
        <button
          id="chat-toggle-btn"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-5 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(120,80,255,0.2) 100%)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff',
            boxShadow: '0 0 24px rgba(0,212,255,0.2), 0 4px 20px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
          }}>
          <ChatIcon cls="w-4 h-4" />
          Chat with AI
          {messages.length > 1 && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>
      )}

      {/* ── Chat Panel (slides up from bottom) ── */}
      {chatOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setChatOpen(false)} />

          {/* Panel */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl flex flex-col"
            style={{
              height: 'min(600px, 80vh)',
              background: 'rgba(10,12,24,0.97)',
              border: '1px solid rgba(0,212,255,0.15)',
              borderBottom: 'none',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 60px rgba(0,212,255,0.12), 0 -4px 30px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              animation: 'chat-slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
                  <BotIcon cls="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">CyberShield AI</p>
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400">Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)}
                className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
                <XIcon cls="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'ai' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                      style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
                      <BotIcon cls="w-3 h-3 text-cyan-400" />
                    </div>
                  )}
                  <div className="max-w-[85%]">
                    {msg.text && (
                      <div className={[
                        'px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'text-white font-medium rounded-tr-sm'
                          : 'text-white/80 rounded-tl-sm',
                      ].join(' ')}
                      style={msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(120,80,255,0.25) 100%)', border: '1px solid rgba(0,212,255,0.2)' }
                        : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }
                      }>
                        {msg.text}
                      </div>
                    )}
                    {msg.action && (
                      <ActionCard label={msg.action.label} detail={msg.action.detail} status={msg.action.status} />
                    )}
                    <p className="text-[9px] text-white/20 mt-1 px-1">{msg.time}</p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {aiTyping && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
                    <BotIcon cls="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400/60"
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

            {/* Input bar */}
            <div className="px-4 pb-4 pt-3 border-t border-white/6 flex-shrink-0">
              {/* Quick action pills inside chat */}
              {messages.length <= 1 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {QUICK_ACTIONS.map(a => {
                    const Icon = a.icon
                    return (
                      <button key={a.id}
                        onClick={() => sendMessage(a.prompt)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors flex-shrink-0"
                        style={{ background: `${a.color}15`, border: `1px solid ${a.color}30`, color: a.color }}>
                        <Icon cls="w-3 h-3" />
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  disabled={aiTyping}
                  className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none transition-colors disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    maxHeight: '120px',
                    caretColor: '#00d4ff',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  id="send-btn"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || aiTyping}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff 0%, #7850ff 100%)',
                    boxShadow: '0 0 16px rgba(0,212,255,0.25)',
                  }}>
                  <SendIcon cls="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-[9px] text-white/20 mt-2 px-1">
                Enter to send · Shift+Enter for new line · All conversations encrypted
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}

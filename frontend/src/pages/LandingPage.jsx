import { Link } from 'react-router-dom'

// ── Shared icon primitives ────────────────────────────────────────────────────
const ShieldIcon  = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const BotIcon     = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/><path d="M12 3v4M8 7h8a2 2 0 012 2v2H6V9a2 2 0 012-2z"/></svg>
const MicIcon     = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
const TicketIcon  = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg>
const LockIcon    = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
const AlertIcon   = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const CheckIcon   = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={cls}><polyline points="20 6 9 17 4 12"/></svg>
const StarIcon    = ({cls}) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={cls}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
const GlobeIcon   = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
const ZapIcon     = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
const ChevronRight = ({cls}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}><path d="M9 18l6-6-6-6"/></svg>

// ── Feature data ─────────────────────────────────────────────────────────────
const features = [
  {
    id: 'voice',
    icon: MicIcon,
    color: 'accent',
    title: 'Voice-First AI Assistant',
    desc: 'Speak naturally to report incidents, reset passwords, and get IT support — no forms, no queues, no friction.',
  },
  {
    id: 'incidents',
    icon: AlertIcon,
    color: 'red',
    title: 'Automated Incident Response',
    desc: 'AI classifies, prioritises, and auto-responds to security incidents in real time — reducing MTTR by up to 80%.',
  },
  {
    id: 'soc',
    icon: ShieldIcon,
    color: 'green',
    title: 'SOC Intelligence Layer',
    desc: 'Continuous threat monitoring, alert triage, and AI-generated response playbooks for your security team.',
  },
  {
    id: 'tickets',
    icon: TicketIcon,
    color: 'amber',
    title: 'AI-Powered IT Helpdesk',
    desc: 'Intelligent ticket routing with AI-generated diagnoses and step-by-step resolution guides for every issue.',
  },
  {
    id: 'password',
    icon: LockIcon,
    color: 'purple',
    title: 'Self-Service Password Reset',
    desc: 'Secure OTP-verified password resets handled entirely by AI — freeing your helpdesk team from routine tasks.',
  },
  {
    id: 'awareness',
    icon: GlobeIcon,
    color: 'accent',
    title: 'Security Awareness Training',
    desc: 'Personalised phishing simulations, security score tracking, and micro-learning modules for every employee.',
  },
]

const colorMap = {
  accent: { text: 'text-[var(--color-soc-accent)]', bg: 'bg-[var(--color-soc-accent-glow)]', border: 'border-[rgba(0,212,255,0.25)]' },
  red:    { text: 'text-[var(--color-soc-red)]',    bg: 'bg-[var(--color-soc-red-glow)]',    border: 'border-[rgba(255,59,92,0.25)]' },
  green:  { text: 'text-[var(--color-soc-green)]',  bg: 'bg-[var(--color-soc-green-glow)]',  border: 'border-[rgba(0,255,136,0.25)]' },
  amber:  { text: 'text-[var(--color-soc-amber)]',  bg: 'bg-[var(--color-soc-amber-glow)]',  border: 'border-[rgba(255,176,32,0.25)]' },
  purple: { text: 'text-[var(--color-soc-purple)]', bg: 'bg-[var(--color-soc-purple-glow)]', border: 'border-[rgba(124,58,237,0.25)]' },
}

// Demo conversation for voice assistant showcase
const demoConversation = [
  { role: 'user', text: 'My VPN keeps disconnecting every 10 minutes.' },
  { role: 'ai',   text: 'I understand — let me diagnose this for you.', typing: false },
  { role: 'system', label: 'IT Ticket Created', detail: 'VPN Connectivity Issue · Priority: High · Diagnosis: MTU mismatch detected on tunnel interface. Recommended fix: Set MTU to 1400 on VPN adapter.' },
  { role: 'user', text: 'I also think I received a phishing email.' },
  { role: 'ai',   text: 'I\'ll create a security incident report immediately.' },
  { role: 'system', label: 'Incident Reported', detail: 'Phishing Attempt · Severity: High · Auto-forwarded to SOC team for analysis.' },
]

const stats = [
  { value: '2.3s', label: 'Avg AI response time' },
  { value: '91%', label: 'Auto-resolution rate' },
  { value: '10k+', label: 'Incidents handled' },
  { value: '60%', label: 'Helpdesk cost reduction' },
]

const securityTips = [
  'Never share your OTP with anyone — not even IT staff.',
  'Use a password manager and enable MFA on every account.',
  'Verify email senders before clicking any link or attachment.',
  'Lock your screen when stepping away from your workstation.',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-soc-bg)] text-[var(--color-soc-text)] overflow-x-hidden">

      {/* ══ NAVIGATION ══════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 border-b border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-bg)]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-accent)] flex items-center justify-center glow-accent flex-shrink-0">
              <ShieldIcon cls="w-5 h-5 stroke-[#050b14]" />
            </div>
            <div>
              <span className="text-base font-black text-[var(--color-soc-text)] tracking-tight">CyberShield</span>
              <span className="text-[10px] text-[var(--color-soc-accent)] ml-1.5 font-bold tracking-widest uppercase">AI</span>
            </div>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'How it works', 'Security', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g,'-')}`}
                className="text-sm text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] transition-colors">
                {item}
              </a>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <Link to="/login"
              className="hidden sm:inline-flex items-center text-sm font-medium text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] transition-colors px-3 py-1.5">
              Log in
            </Link>
            <Link to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg
                         bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)]
                         hover:opacity-90 transition-opacity glow-accent">
              Get Started
              <ChevronRight cls="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-20 pb-28 px-4 sm:px-6">
        {/* Background glow orbs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[var(--color-soc-accent)] opacity-[0.04] blur-[120px]" />
        <div className="pointer-events-none absolute top-20 -left-40 w-[400px] h-[400px] rounded-full bg-[var(--color-soc-purple)] opacity-[0.06] blur-[100px]" />
        <div className="pointer-events-none absolute top-40 -right-40 w-[400px] h-[400px] rounded-full bg-[var(--color-soc-red)] opacity-[0.05] blur-[100px]" />

        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(0,212,255,0.25)] bg-[var(--color-soc-accent-glow)] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-green)] animate-pulse" />
            <span className="text-xs font-semibold text-[var(--color-soc-accent)] tracking-wider uppercase">AI-Powered · Enterprise-Grade</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-6">
            Your AI-Powered{' '}
            <span className="text-[var(--color-soc-accent)] text-glow-accent">Cybersecurity</span>
            {' '}&amp;{' '}
            <br className="hidden sm:block" />
            IT Helpdesk Assistant
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-[var(--color-soc-text-muted)] max-w-2xl mx-auto leading-relaxed mb-10">
            Talk naturally. Report incidents. Reset passwords. Get IT support.
            {' '}<span className="text-[var(--color-soc-text)] font-medium">All through a single AI assistant.</span>
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/login"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] font-bold text-base hover:opacity-90 transition-opacity glow-accent w-full sm:w-auto justify-center">
              <MicIcon cls="w-5 h-5" />
              Launch AI Assistant
            </Link>
            <Link to="/login"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-[var(--color-soc-border)] bg-[var(--color-soc-card)] text-[var(--color-soc-text)] font-semibold text-base hover:border-[var(--color-soc-accent)] transition-colors w-full sm:w-auto justify-center">
              SOC Admin Login
              <ChevronRight cls="w-4 h-4 text-[var(--color-soc-text-muted)]" />
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl p-4 bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                <p className="text-2xl font-black text-[var(--color-soc-accent)] tabular-nums">{s.value}</p>
                <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ VOICE ASSISTANT SHOWCASE ════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-[var(--color-soc-surface)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-soc-accent)] font-bold mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Voice-First AI at the Centre</h2>
            <p className="text-[var(--color-soc-text-muted)] max-w-xl mx-auto">
              One conversation handles everything. The AI understands context, creates tickets, escalates threats, and guides resolution — all in real time.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left: assistant mock */}
            <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
                <div className="w-8 h-8 rounded-full bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.3)] flex items-center justify-center">
                  <BotIcon cls="w-4 h-4 text-[var(--color-soc-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--color-soc-text)]">CyberShield AI</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-green)] animate-pulse" />
                    <span className="text-[10px] text-[var(--color-soc-green)]">Active · Listening</span>
                  </div>
                </div>
                <div className="ml-auto">
                  <div className="flex items-center gap-0.5 h-6">
                    {[3,5,8,5,6,4,7,5,3,6,8,4].map((h, i) => (
                      <div key={i} className="w-0.5 rounded-full bg-[var(--color-soc-accent)] opacity-70"
                        style={{ height: `${h * 3}px`, animation: `pulse-ring ${0.6 + i * 0.1}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Conversation */}
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {demoConversation.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'user' && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] text-xs font-medium">
                          {msg.text}
                        </div>
                      </div>
                    )}
                    {msg.role === 'ai' && (
                      <div className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.3)] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BotIcon cls="w-3 h-3 text-[var(--color-soc-accent)]" />
                        </div>
                        <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] text-xs text-[var(--color-soc-text)]">
                          {msg.text}
                        </div>
                      </div>
                    )}
                    {msg.role === 'system' && (
                      <div className="mx-2 p-3 rounded-xl bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.2)]">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckIcon cls="w-3.5 h-3.5 text-[var(--color-soc-green)]" />
                          <span className="text-[10px] font-bold text-[var(--color-soc-green)] uppercase tracking-wider">{msg.label}</span>
                        </div>
                        <p className="text-[10px] text-[var(--color-soc-text-muted)] leading-relaxed">{msg.detail}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input bar (decorative) */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)]">
                  <span className="text-xs text-[var(--color-soc-text-muted)] flex-1">Speak or type your request...</span>
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-soc-accent)] flex items-center justify-center flex-shrink-0">
                    <MicIcon cls="w-3.5 h-3.5 stroke-[#050b14]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: capability list */}
            <div className="space-y-4">
              {[
                { icon: TicketIcon, color: 'amber', title: 'IT Support', desc: 'AI diagnoses your issue, creates a ticket, and provides step-by-step fix instructions instantly.' },
                { icon: LockIcon,   color: 'accent', title: 'Password Reset', desc: 'Secure identity verification via OTP, then AI processes your reset request — no helpdesk wait.' },
                { icon: AlertIcon,  color: 'red',    title: 'Incident Reporting', desc: 'Describe a suspicious email or breach attempt — AI classifies severity and notifies your SOC team.' },
                { icon: ShieldIcon, color: 'green',  title: 'Security Guidance', desc: 'Ask any security question and get instant, policy-aligned guidance from your AI assistant.' },
              ].map((item) => {
                const c = colorMap[item.color]
                const Icon = item.icon
                return (
                  <div key={item.title} className="flex gap-4 p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] hover:border-[rgba(0,212,255,0.2)] transition-colors group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text} border ${c.border}`}>
                      <Icon cls="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-soc-text)] mb-1">{item.title}</h3>
                      <p className="text-xs text-[var(--color-soc-text-muted)] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-soc-accent)] font-bold mb-3">Platform Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Everything your security team needs</h2>
            <p className="text-[var(--color-soc-text-muted)] max-w-xl mx-auto">
              One unified AI platform covering the full spectrum — from employee self-service to SOC-grade threat response.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const c = colorMap[f.color]
              const Icon = f.icon
              return (
                <div key={f.id}
                  className="group p-6 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] hover:border-[rgba(0,212,255,0.2)] transition-all hover:-translate-y-0.5 cursor-default">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${c.bg} ${c.text} border ${c.border}`}>
                    <Icon cls="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--color-soc-text)] mb-2">{f.title}</h3>
                  <p className="text-xs text-[var(--color-soc-text-muted)] leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ SECURITY AWARENESS ══════════════════════════════════════════════ */}
      <section id="security" className="py-24 px-4 sm:px-6 bg-[var(--color-soc-surface)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-soc-green)] font-bold mb-3">Security Awareness</p>
              <h2 className="text-3xl sm:text-4xl font-black mb-5">
                Turn every employee into a{' '}
                <span className="text-[var(--color-soc-green)]">security asset</span>
              </h2>
              <p className="text-[var(--color-soc-text-muted)] mb-8 leading-relaxed">
                CyberShield's Security Awareness module delivers personalised training, phishing simulations, and daily security nudges — all scored and tracked automatically.
              </p>
              <ul className="space-y-3">
                {[
                  'Personalised phishing simulations per employee risk profile',
                  'Daily micro-learning tips pushed through the AI assistant',
                  'Real-time security score tracking and department benchmarks',
                  'Policy compliance tracking and automated reminders',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--color-soc-text-muted)]">
                    <CheckIcon cls="w-4 h-4 text-[var(--color-soc-green)] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Security tips widget mock */}
            <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldIcon cls="w-4 h-4 text-[var(--color-soc-green)]" />
                  <span className="text-sm font-bold text-[var(--color-soc-text)]">Security Score</span>
                </div>
                <span className="text-[10px] text-[var(--color-soc-text-muted)] font-mono">JUNE 2026</span>
              </div>

              {/* Score ring */}
              <div className="px-6 py-8 flex items-center gap-8">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-soc-border-subtle)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-soc-green)" strokeWidth="3"
                      strokeDasharray="85 15" strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 4px var(--color-soc-green))' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-[var(--color-soc-text)]">85</span>
                    <span className="text-[9px] text-[var(--color-soc-green)] font-bold uppercase tracking-wider">Score</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {[['Phishing Tests', 92], ['Policy Quizzes', 78], ['Training Hours', 88]].map(([label, val]) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[var(--color-soc-text-muted)]">{label}</span>
                        <span className="text-[var(--color-soc-text)] font-bold">{val}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--color-soc-green)]"
                          style={{ width: `${val}%`, boxShadow: '0 0 6px var(--color-soc-green)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily tips */}
              <div className="px-5 pb-5 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-3">Daily Security Tips</p>
                {securityTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)]">
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-[var(--color-soc-accent-glow)]">
                      <ZapIcon cls="w-2.5 h-2.5 text-[var(--color-soc-accent)]" />
                    </div>
                    <p className="text-[10px] text-[var(--color-soc-text-muted)] leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA BAND ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[600px] h-[400px] rounded-full bg-[var(--color-soc-accent)] opacity-[0.05] blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(0,212,255,0.25)] bg-[var(--color-soc-accent-glow)] mb-6">
            <StarIcon cls="w-3 h-3 text-[var(--color-soc-accent)]" />
            <span className="text-xs font-semibold text-[var(--color-soc-accent)]">Trusted by 500+ enterprise security teams</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-5">
            Ready to automate your{' '}
            <span className="text-[var(--color-soc-accent)] text-glow-accent">security operations</span>?
          </h2>
          <p className="text-[var(--color-soc-text-muted)] mb-8 text-lg">
            Deploy in minutes. No agents to install. Just AI that works.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] font-bold text-base hover:opacity-90 transition-opacity glow-accent w-full sm:w-auto justify-center">
              Get Started Free
              <ChevronRight cls="w-5 h-5" />
            </Link>
            <Link to="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-[var(--color-soc-border)] text-[var(--color-soc-text)] font-semibold text-base hover:border-[var(--color-soc-accent)] transition-colors w-full sm:w-auto justify-center">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[var(--color-soc-border-subtle)] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-soc-accent)] flex items-center justify-center">
              <ShieldIcon cls="w-4 h-4 stroke-[#050b14]" />
            </div>
            <span className="text-sm font-bold text-[var(--color-soc-text)]">CyberShield AI</span>
          </div>
          <p className="text-[11px] text-[var(--color-soc-text-muted)] text-center">
            © 2026 CyberShield AI Platform. Enterprise Cybersecurity & IT Automation.
          </p>
          <div className="flex items-center gap-4">
            {['Privacy', 'Security', 'Terms'].map((item) => (
              <a key={item} href="#" className="text-[11px] text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] transition-colors">
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}

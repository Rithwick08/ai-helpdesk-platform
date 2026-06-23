/**
 * EmployeeSecurityPage.jsx
 *
 * Security Awareness hub for employees — NOT an admin page.
 * Purpose: help employees improve their cybersecurity knowledge.
 *
 * Sections:
 *  1. Recommended Training   — video cards (topic, difficulty, duration, progress)
 *  2. Company Security Updates — timeline cards (priority, title, description, date)
 *  3. Continue Learning       — recently-watched videos with resume button
 *  4. Ask AI About Training   — single large AI question input (no chat, just ask)
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Clock,
  ChevronRight,
  BookOpen,
  Bell,
  RotateCcw,
  Send,
  ShieldCheck,
  AlertTriangle,
  Info,
  Loader2,
  Sparkles,
  Lock,
  Wifi,
  Mail,
  Smartphone,
  Eye,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Static data (replace with API calls once backend endpoint is ready)
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDED = [
  {
    id: 1,
    topic: 'Phishing & Social Engineering',
    description: 'Learn how attackers craft convincing phishing emails and how to spot them before it is too late.',
    difficulty: 'Beginner',
    duration: '12 min',
    progress: 0,
    icon: Mail,
    accent: '#00d4ff',
    thumbnailGradient: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(120,80,255,0.15) 100%)',
    tag: 'Recommended for you',
  },
  {
    id: 2,
    topic: 'Password Security & MFA',
    description: 'Why strong passwords alone aren\'t enough — and how multi-factor authentication protects your accounts even when credentials leak.',
    difficulty: 'Beginner',
    duration: '8 min',
    progress: 40,
    icon: Lock,
    accent: '#00ff88',
    thumbnailGradient: 'linear-gradient(135deg, rgba(0,255,136,0.2) 0%, rgba(0,212,255,0.1) 100%)',
    tag: 'In Progress',
  },
  {
    id: 3,
    topic: 'Secure Remote Work & VPN',
    description: 'Best practices for working remotely — VPN usage, public Wi-Fi risks, screen privacy, and endpoint security.',
    difficulty: 'Intermediate',
    duration: '15 min',
    progress: 0,
    icon: Wifi,
    accent: '#7850ff',
    thumbnailGradient: 'linear-gradient(135deg, rgba(120,80,255,0.25) 0%, rgba(168,85,247,0.15) 100%)',
    tag: 'New',
  },
  {
    id: 4,
    topic: 'Mobile Device Security',
    description: 'Protecting company data on personal and corporate mobile devices — MDM, app permissions, and lost device procedures.',
    difficulty: 'Intermediate',
    duration: '10 min',
    progress: 100,
    icon: Smartphone,
    accent: '#ffb020',
    thumbnailGradient: 'linear-gradient(135deg, rgba(255,176,32,0.2) 0%, rgba(255,59,92,0.1) 100%)',
    tag: 'Completed',
  },
  {
    id: 5,
    topic: 'Zero Trust Security Model',
    description: 'Understand the "never trust, always verify" philosophy and how it changes the way your organisation protects resources.',
    difficulty: 'Advanced',
    duration: '20 min',
    progress: 0,
    icon: Eye,
    accent: '#ff3b5c',
    thumbnailGradient: 'linear-gradient(135deg, rgba(255,59,92,0.2) 0%, rgba(120,80,255,0.15) 100%)',
    tag: 'Recommended for you',
  },
]

const SECURITY_UPDATES = [
  {
    id: 1,
    priority: 'Critical',
    title: 'Mandatory Phishing Simulation — Complete by Friday',
    description: 'The IT Security team has launched a mandatory phishing simulation exercise. All employees must complete the awareness check by end of this week. Check your inbox for a test email.',
    date: 'Today',
    icon: AlertTriangle,
  },
  {
    id: 2,
    priority: 'High',
    title: 'New Password Policy Takes Effect July 1st',
    description: 'Starting July 1st, all employee passwords must be at least 16 characters and renewed every 90 days. The company password manager has been updated to help you comply automatically.',
    date: '2 days ago',
    icon: Lock,
  },
  {
    id: 3,
    priority: 'Medium',
    title: 'MFA Enforcement Expanded to All Internal Tools',
    description: 'Multi-factor authentication is now required for Jira, Confluence, and all internal dashboards, in addition to email. Please enrol a second factor in your account settings.',
    date: '5 days ago',
    icon: ShieldCheck,
  },
  {
    id: 4,
    priority: 'Info',
    title: 'Security Awareness Month — New Training Modules Available',
    description: 'October is Cybersecurity Awareness Month. Five new training modules have been added to your portal. Employees who complete all five will receive a Digital Security Champion badge.',
    date: '1 week ago',
    icon: Info,
  },
]

const RECENTLY_WATCHED = [
  {
    id: 1,
    topic: 'Password Security & MFA',
    progress: 40,
    duration: '8 min',
    timeLeft: '5 min left',
    icon: Lock,
    accent: '#00ff88',
    thumbnailGradient: 'linear-gradient(135deg, rgba(0,255,136,0.2) 0%, rgba(0,212,255,0.1) 100%)',
    lastWatched: '2 hours ago',
  },
  {
    id: 2,
    topic: 'Mobile Device Security',
    progress: 100,
    duration: '10 min',
    timeLeft: 'Completed',
    icon: Smartphone,
    accent: '#ffb020',
    thumbnailGradient: 'linear-gradient(135deg, rgba(255,176,32,0.2) 0%, rgba(255,59,92,0.1) 100%)',
    lastWatched: '1 day ago',
  },
  {
    id: 3,
    topic: 'Intro to Cybersecurity Basics',
    progress: 100,
    duration: '6 min',
    timeLeft: 'Completed',
    icon: ShieldCheck,
    accent: '#7850ff',
    thumbnailGradient: 'linear-gradient(135deg, rgba(120,80,255,0.25) 0%, rgba(168,85,247,0.15) 100%)',
    lastWatched: '3 days ago',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLE = {
  Beginner:     { bg: 'rgba(0,255,136,0.1)',  text: '#00ff88', border: 'rgba(0,255,136,0.25)'  },
  Intermediate: { bg: 'rgba(0,212,255,0.1)',  text: '#00d4ff', border: 'rgba(0,212,255,0.25)'  },
  Advanced:     { bg: 'rgba(255,176,32,0.1)', text: '#ffb020', border: 'rgba(255,176,32,0.25)' },
}

const PRIORITY_STYLE = {
  Critical: { bg: 'rgba(255,59,92,0.12)',  text: '#ff3b5c', border: 'rgba(255,59,92,0.3)',  dot: '#ff3b5c' },
  High:     { bg: 'rgba(255,176,32,0.12)', text: '#ffb020', border: 'rgba(255,176,32,0.3)', dot: '#ffb020' },
  Medium:   { bg: 'rgba(0,212,255,0.1)',   text: '#00d4ff', border: 'rgba(0,212,255,0.25)', dot: '#00d4ff' },
  Info:     { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)', dot: 'rgba(255,255,255,0.3)' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading component
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, subtitle, accent = '#00d4ff' }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
        }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div>
        <h2 className="text-[15px] font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/35 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Training Card
// ─────────────────────────────────────────────────────────────────────────────
function TrainingCard({ item, index }) {
  const diff = DIFFICULTY_STYLE[item.difficulty]
  const isComplete = item.progress === 100
  const inProgress = item.progress > 0 && item.progress < 100
  const Icon = item.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
      }}
      whileHover={{
        boxShadow: `0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px ${item.accent}22`,
      }}>

      {/* Thumbnail */}
      <div className="relative h-36 flex items-center justify-center overflow-hidden"
        style={{ background: item.thumbnailGradient }}>

        {/* Tag badge */}
        <div className="absolute top-3 left-3">
          <span className="text-[9px] font-bold px-2 py-1 rounded-full tracking-wider"
            style={{
              background: isComplete ? 'rgba(0,255,136,0.15)' : inProgress ? 'rgba(0,212,255,0.15)' : 'rgba(120,80,255,0.15)',
              color: isComplete ? '#00ff88' : inProgress ? '#00d4ff' : '#a78bfa',
              border: `1px solid ${isComplete ? 'rgba(0,255,136,0.25)' : inProgress ? 'rgba(0,212,255,0.25)' : 'rgba(120,80,255,0.25)'}`,
            }}>
            {item.tag}
          </span>
        </div>

        {/* Play icon center */}
        <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
          style={{
            background: `color-mix(in srgb, ${item.accent} 15%, rgba(10,12,24,0.7))`,
            border: `1.5px solid ${item.accent}50`,
            boxShadow: `0 0 20px ${item.accent}30`,
          }}>
          <Icon size={22} style={{ color: item.accent }} />
        </div>

        {/* Progress bar (bottom of thumbnail) */}
        {item.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${item.progress}%`,
                background: isComplete ? '#00ff88' : item.accent,
                boxShadow: `0 0 8px ${isComplete ? '#00ff88' : item.accent}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Difficulty + duration */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: diff.bg, color: diff.text, border: `1px solid ${diff.border}` }}>
            {item.difficulty}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30 font-medium">
            <Clock size={10} />
            {item.duration}
          </span>
          {item.progress > 0 && item.progress < 100 && (
            <span className="ml-auto text-[10px] font-bold text-[#00d4ff]">{item.progress}%</span>
          )}
          {isComplete && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[#00ff88]">
              <ShieldCheck size={10} /> Done
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-bold text-white leading-snug group-hover:text-[#00d4ff] transition-colors duration-200">
          {item.topic}
        </h3>

        {/* Description */}
        <p className="text-[11px] text-white/40 leading-relaxed flex-1 line-clamp-2">
          {item.description}
        </p>

        {/* Watch button */}
        <button className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:brightness-110"
          style={{
            background: isComplete
              ? 'rgba(255,255,255,0.05)'
              : `linear-gradient(135deg, ${item.accent}20 0%, ${item.accent}10 100%)`,
            border: `1px solid ${isComplete ? 'rgba(255,255,255,0.08)' : item.accent + '35'}`,
            color: isComplete ? 'rgba(255,255,255,0.35)' : item.accent,
          }}>
          {isComplete ? (
            <><RotateCcw size={12} /> Rewatch</>
          ) : inProgress ? (
            <><Play size={12} style={{ fill: 'currentColor' }} /> Continue</>
          ) : (
            <><Play size={12} style={{ fill: 'currentColor' }} /> Watch</>
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Update Card
// ─────────────────────────────────────────────────────────────────────────────
function UpdateCard({ item, index, isLast }) {
  const p = PRIORITY_STYLE[item.priority]
  const Icon = item.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-4">

      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10"
          style={{ background: p.bg, border: `1px solid ${p.border}` }}>
          <Icon size={14} style={{ color: p.text }} />
        </div>
        {!isLast && (
          <div className="flex-1 w-px my-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>

          <div className="flex items-start justify-between gap-3 mb-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide"
              style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}` }}>
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: p.dot }} />
              {item.priority}
            </span>
            <span className="text-[10px] text-white/25 font-medium">{item.date}</span>
          </div>

          <h3 className="text-[13px] font-bold text-white mb-1.5 leading-snug">{item.title}</h3>
          <p className="text-[11px] text-white/40 leading-relaxed">{item.description}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Resume Card
// ─────────────────────────────────────────────────────────────────────────────
function ResumeCard({ item, index }) {
  const Icon = item.icon
  const isComplete = item.progress === 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer hover:bg-white/4"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>

      {/* Thumbnail mini */}
      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: item.thumbnailGradient, border: `1px solid ${item.accent}25` }}>
        <Icon size={20} style={{ color: item.accent }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-[13px] font-semibold text-white/90 truncate">{item.topic}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-white/30">{item.lastWatched}</span>
          <span className="text-white/15">·</span>
          <span className="text-[10px] font-semibold"
            style={{ color: isComplete ? '#00ff88' : item.accent }}>
            {item.timeLeft}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full"
            style={{
              width: `${item.progress}%`,
              background: isComplete ? '#00ff88' : item.accent,
              boxShadow: `0 0 6px ${isComplete ? '#00ff88' : item.accent}80`,
            }}
          />
        </div>
      </div>

      {/* Resume/rewatch button */}
      <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold flex-shrink-0 transition-all duration-200"
        style={{
          background: isComplete ? 'rgba(255,255,255,0.05)' : `${item.accent}18`,
          border: `1px solid ${isComplete ? 'rgba(255,255,255,0.08)' : item.accent + '30'}`,
          color: isComplete ? 'rgba(255,255,255,0.3)' : item.accent,
        }}>
        {isComplete ? <><RotateCcw size={11} /> Rewatch</> : <><Play size={11} style={{ fill: 'currentColor' }} /> Resume</>}
      </button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ask AI Input
// ─────────────────────────────────────────────────────────────────────────────
function AskAISection() {
  const [question, setQuestion]   = useState('')
  const [answer, setAnswer]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [focused, setFocused]     = useState(false)

  const DEMO_ANSWERS = {
    phishing: 'Phishing attacks typically use social engineering to create urgency — fake IT warnings, executive impersonations, or invoice fraud. Always verify the sender\'s domain, hover over links before clicking, and report suspicious emails to security@corp.com immediately.',
    mfa: 'Multi-factor authentication adds a second layer of verification beyond your password. Even if an attacker has your password, they cannot access your account without the second factor (usually a code from an authenticator app or SMS). Always choose an authenticator app over SMS for stronger security.',
    vpn: 'Always connect to the company VPN before accessing internal resources remotely. Avoid public Wi-Fi without VPN — unencrypted networks allow attackers to intercept your traffic. If your VPN disconnects unexpectedly, stop work until you can reconnect.',
    default: 'Great question! Cybersecurity is a shared responsibility. Your organisation\'s Security Team is always available at security@corp.com for specific concerns. For training questions, review the recommended modules in your portal — they cover phishing, passwords, VPN, and more in detail.',
  }

  function getAnswer(q) {
    const t = q.toLowerCase()
    if (t.includes('phish') || t.includes('email') || t.includes('link')) return DEMO_ANSWERS.phishing
    if (t.includes('mfa') || t.includes('multi') || t.includes('factor') || t.includes('authenticat')) return DEMO_ANSWERS.mfa
    if (t.includes('vpn') || t.includes('remote') || t.includes('wifi')) return DEMO_ANSWERS.vpn
    return DEMO_ANSWERS.default
  }

  function handleAsk() {
    if (!question.trim() || loading) return
    setLoading(true)
    setAnswer(null)
    setTimeout(() => {
      setAnswer(getAnswer(question))
      setLoading(false)
    }, 1400)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAsk()
  }

  return (
    <div className="rounded-2xl p-6"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: focused ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: focused ? '0 0 0 1px rgba(0,212,255,0.1), 0 8px 40px rgba(0,0,0,0.2)' : '0 2px 20px rgba(0,0,0,0.15)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.22)' }}>
          <Sparkles size={15} className="text-cyan-400" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-white">Ask AI About Training</p>
          <p className="text-[10px] text-white/30">Get instant explanations on any cybersecurity topic</p>
        </div>
        <span className="ml-auto text-[9px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.2)' }}>
          Powered by AI
        </span>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          id="ai-question-input"
          rows={4}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder="Ask anything about cybersecurity...&#10;&#10;e.g. How do I recognise a phishing email? · What is MFA? · Why should I use a VPN?"
          disabled={loading}
          className="w-full resize-none rounded-xl px-4 py-3.5 text-[13px] outline-none transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            caretColor: '#00d4ff',
            lineHeight: 1.65,
          }}
        />
      </div>

      {/* Hint + Send */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-white/20">⌘ + Enter to send</p>
        <button
          id="ask-ai-send-btn"
          onClick={handleAsk}
          disabled={!question.trim() || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(120,80,255,0.2) 100%)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff',
            boxShadow: question.trim() ? '0 0 20px rgba(0,212,255,0.15)' : 'none',
          }}>
          {loading ? <><Loader2 size={13} className="animate-spin" /> Thinking…</> : <><Send size={13} /> Ask AI</>}
        </button>
      </div>

      {/* AI Answer */}
      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 overflow-hidden">
            <div className="p-4 rounded-xl"
              style={{
                background: 'rgba(0,212,255,0.05)',
                border: '1px solid rgba(0,212,255,0.15)',
              }}>
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles size={12} className="text-cyan-400" />
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">AI Answer</span>
              </div>
              <p className="text-[13px] text-white/70 leading-relaxed">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeSecurityPage() {
  return (
    <div className="min-h-screen px-5 sm:px-8 py-8 max-w-[1200px] mx-auto"
      style={{ color: '#fff' }}>

      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={18} className="text-cyan-400" />
          <span className="text-[11px] font-semibold text-cyan-400/60 uppercase tracking-[0.2em]">
            Employee Portal
          </span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
          Security Awareness
        </h1>
        <p className="text-[13px] text-white/35 leading-relaxed">
          Personalised recommendations based on your recent interactions.
        </p>
      </motion.div>

      {/* ── Section 1 — Recommended Training ── */}
      <section className="mb-12">
        <SectionHeading
          icon={Play}
          title="Recommended Training"
          subtitle="Curated for your role and recent activity"
          accent="#00d4ff"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {RECOMMENDED.map((item, i) => (
            <TrainingCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </section>

      {/* ── Two-column: Updates + Continue Learning ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">

        {/* ── Section 2 — Security Updates ── */}
        <section>
          <SectionHeading
            icon={Bell}
            title="Company Security Updates"
            subtitle="Latest alerts and policy changes from your security team"
            accent="#ffb020"
          />
          <div>
            {SECURITY_UPDATES.map((item, i) => (
              <UpdateCard
                key={item.id}
                item={item}
                index={i}
                isLast={i === SECURITY_UPDATES.length - 1}
              />
            ))}
          </div>
        </section>

        {/* ── Section 3 — Continue Learning ── */}
        <section>
          <SectionHeading
            icon={BookOpen}
            title="Continue Learning"
            subtitle="Pick up where you left off"
            accent="#00ff88"
          />
          <div className="flex flex-col gap-3">
            {RECENTLY_WATCHED.map((item, i) => (
              <ResumeCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </section>
      </div>

      {/* ── Section 4 — Ask AI ── */}
      <section className="mb-10">
        <SectionHeading
          icon={Sparkles}
          title="Ask AI About Training"
          subtitle="Get instant answers to any cybersecurity question"
          accent="#7850ff"
        />
        <AskAISection />
      </section>
    </div>
  )
}

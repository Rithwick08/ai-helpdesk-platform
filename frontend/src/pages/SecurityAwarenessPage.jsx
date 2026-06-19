/**
 * SecurityAwarenessPage.jsx
 *
 * Security Awareness Center — frontend-only training hub.
 *
 * Sections:
 *  1. Hero metrics row  (Awareness Score ring · Trainings Completed · Risk Level · Streak)
 *  2. Daily Tip Card    (rotatable, bookmark action)
 *  3. Security Quiz     (5 questions, score reveal, retake)
 *  4. Awareness Articles (category-tagged cards)
 *  5. Recommended Learning Paths (progress bars)
 *  6. Recent Security News (placeholder cards)
 */

import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_TIPS = [
  { icon: '🔒', category: 'Authentication', tip: 'Enable Multi-Factor Authentication (MFA) on every work account. Even if your password is compromised, MFA stops 99.9% of automated account attacks.' },
  { icon: '📧', category: 'Phishing', tip: 'Always verify the sender\'s email domain before clicking any link. Attackers often use look-alike domains like "micros0ft.com" or "paypa1.com".' },
  { icon: '🔑', category: 'Passwords', tip: 'Use a password manager. It creates unique, strong passwords for every site — you only need to remember one master password.' },
  { icon: '💻', category: 'Physical Security', tip: 'Lock your screen every time you step away from your desk (Win+L or Cmd+Ctrl+Q). An unlocked laptop is an open door for attackers.' },
  { icon: '🌐', category: 'Network', tip: 'Never connect to public Wi-Fi for sensitive work. If you must, always use the company VPN — unencrypted Wi-Fi lets attackers intercept your traffic.' },
  { icon: '📱', category: 'Mobile Security', tip: 'Keep your work mobile device up to date. OS updates patch critical security vulnerabilities that attackers actively exploit.' },
  { icon: '☁️', category: 'Cloud Security', tip: 'Never share cloud storage links publicly. Always set expiry dates and password-protect sensitive shared documents.' },
]

const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: 'You receive an email from "IT Support" asking you to click a link and verify your credentials within 24 hours or your account will be suspended. What should you do?',
    options: [
      'Click the link and log in immediately to avoid suspension',
      'Forward it to your manager and ignore it',
      'Report it to the security team as a phishing attempt and do not click',
      'Reply to the email asking if it is legitimate',
    ],
    correct: 2,
    explanation: 'This is a classic phishing tactic. Legitimate IT departments never ask for credentials via email or create artificial urgency. Always report to the security team.',
  },
  {
    id: 2,
    question: 'Which of the following is the strongest password?',
    options: [
      'Password123!',
      'Tr0ub4dor&3',
      'correct-horse-battery-staple-7!',
      'MyBirthday1990',
    ],
    correct: 2,
    explanation: 'Long passphrases with random words are significantly stronger than short complex passwords. Length beats complexity — "correct-horse-battery-staple" has 44 bits of entropy.',
  },
  {
    id: 3,
    question: 'A colleague leaves their laptop unlocked while grabbing coffee in a shared workspace. What is the best course of action?',
    options: [
      'Leave it — it\'s not your responsibility',
      'Lock it for them and send a friendly reminder about the screen-lock policy',
      'Use the opportunity to check if they have any sensitive files',
      'Post about it on internal chat to embarrass them',
    ],
    correct: 1,
    explanation: 'Locking a colleague\'s screen is a helpful security act. A quick friendly reminder reinforces a culture of security without blame.',
  },
  {
    id: 4,
    question: 'You find a USB drive in the company car park labelled "Q3 Salaries". What should you do?',
    options: [
      'Plug it in to see what is on it',
      'Plug it in on a personal device to avoid infecting work systems',
      'Hand it to the IT/Security team without plugging it in anywhere',
      'Throw it away so no one else finds it',
    ],
    correct: 2,
    explanation: 'USB drops are a real attack vector. Malicious USBs can execute code the moment they are plugged in. Always hand found drives to security without connecting them.',
  },
  {
    id: 5,
    question: 'What does "Zero Trust" security mean in the context of enterprise networks?',
    options: [
      'Never trust any user or device, even if they are inside the corporate network',
      'Only trust users who have been with the company for more than a year',
      'Trust all traffic that originates from the internal network',
      'Zero-cost security solutions are preferred over paid tools',
    ],
    correct: 0,
    explanation: '"Never trust, always verify" — Zero Trust assumes breaches can and do happen inside the perimeter. Every request is authenticated and authorised regardless of origin.',
  },
]

const ARTICLES = [
  {
    id: 1,
    category: 'Phishing',
    categoryColor: 'var(--color-soc-red)',
    categoryBg: 'var(--color-soc-red-glow)',
    title: 'How to Spot a Sophisticated Spear-Phishing Email',
    summary: 'Spear-phishing attacks target specific individuals using personalised context scraped from LinkedIn and social media. Learn the seven tell-tale signs your security team looks for.',
    readTime: '5 min read',
    icon: '📧',
    level: 'Beginner',
  },
  {
    id: 2,
    category: 'Zero Trust',
    categoryColor: 'var(--color-soc-accent)',
    categoryBg: 'var(--color-soc-accent-glow)',
    title: 'Understanding Zero Trust Architecture for End Users',
    summary: 'Zero Trust means every access request is verified, regardless of location. This guide explains what this means for your daily work and why you may be asked to re-authenticate more often.',
    readTime: '7 min read',
    icon: '🛡️',
    level: 'Intermediate',
  },
  {
    id: 3,
    category: 'Ransomware',
    categoryColor: 'var(--color-soc-amber)',
    categoryBg: 'var(--color-soc-amber-glow)',
    title: 'What to Do If You Suspect a Ransomware Attack',
    summary: 'If files suddenly become inaccessible or you see a ransom note, every second counts. Follow this immediate response checklist to contain the damage and notify your SOC.',
    readTime: '4 min read',
    icon: '🔐',
    level: 'All Levels',
  },
  {
    id: 4,
    category: 'Password Security',
    categoryColor: 'var(--color-soc-green)',
    categoryBg: 'var(--color-soc-green-glow)',
    title: 'Enterprise Password Manager: Setup & Best Practices',
    summary: 'Your company provides a password manager. This guide walks you through setup, importing existing credentials, generating secure passwords, and safely sharing credentials with your team.',
    readTime: '8 min read',
    icon: '🔑',
    level: 'Beginner',
  },
  {
    id: 5,
    category: 'Social Engineering',
    categoryColor: 'var(--color-soc-red)',
    categoryBg: 'var(--color-soc-red-glow)',
    title: 'The Anatomy of a Vishing (Voice Phishing) Attack',
    summary: 'Attackers impersonate IT support, banks, and executives over the phone to extract sensitive information. Learn the psychological tactics used and how to verify caller identity.',
    readTime: '6 min read',
    icon: '📞',
    level: 'Intermediate',
  },
  {
    id: 6,
    category: 'Compliance',
    categoryColor: 'var(--color-soc-accent)',
    categoryBg: 'var(--color-soc-accent-glow)',
    title: 'GDPR & Data Handling: What Every Employee Must Know',
    summary: 'Mishandling personal data — even accidentally — carries serious regulatory penalties. Understand your obligations under GDPR and your company\'s data classification policy.',
    readTime: '10 min read',
    icon: '📋',
    level: 'All Levels',
  },
]

const LEARNING_PATHS = [
  {
    id: 1,
    title: 'Security Foundations',
    description: 'Core concepts every employee needs — phishing, passwords, device security.',
    modules: 6,
    completed: 6,
    duration: '45 min',
    icon: '🏆',
    color: 'var(--color-soc-green)',
    badge: 'Completed',
  },
  {
    id: 2,
    title: 'Phishing & Social Engineering',
    description: 'Advanced phishing simulation training and social engineering defence.',
    modules: 8,
    completed: 5,
    duration: '1.5 hrs',
    icon: '🎣',
    color: 'var(--color-soc-amber)',
    badge: 'In Progress',
  },
  {
    id: 3,
    title: 'Zero Trust & Access Management',
    description: 'Modern network security — MFA, least privilege, conditional access policies.',
    modules: 10,
    completed: 2,
    duration: '2 hrs',
    icon: '🔒',
    color: 'var(--color-soc-accent)',
    badge: 'In Progress',
  },
  {
    id: 4,
    title: 'Incident Response Basics',
    description: 'How to recognise, report, and respond to a security incident correctly.',
    modules: 7,
    completed: 0,
    duration: '1 hr',
    icon: '🚨',
    color: 'var(--color-soc-red)',
    badge: 'Not Started',
  },
  {
    id: 5,
    title: 'Cloud Security Essentials',
    description: 'Securing cloud storage, collaboration tools, and SaaS applications.',
    modules: 5,
    completed: 0,
    duration: '50 min',
    icon: '☁️',
    color: 'var(--color-soc-text-muted)',
    badge: 'Not Started',
  },
]

const SECURITY_NEWS = [
  {
    id: 1,
    headline: 'Major Ransomware Group Disrupted by Joint International Law Enforcement Operation',
    source: 'CyberShield Intel Feed',
    time: '2 hours ago',
    severity: 'High',
    category: 'Threat Intel',
  },
  {
    id: 2,
    headline: 'Critical Vulnerability Discovered in Popular Enterprise VPN Solution — Patch Available',
    source: 'CISA Advisory',
    time: '5 hours ago',
    severity: 'Critical',
    category: 'Vulnerability',
  },
  {
    id: 3,
    headline: 'New Phishing Campaign Targeting Finance Departments Using AI-Generated Deepfake Audio',
    source: 'Threat Intelligence',
    time: '1 day ago',
    severity: 'Medium',
    category: 'Phishing',
  },
  {
    id: 4,
    headline: 'NIST Releases Updated Cybersecurity Framework 2.0 — Key Changes for Enterprises',
    source: 'NIST',
    time: '2 days ago',
    severity: 'Info',
    category: 'Compliance',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NEWS_SEVERITY_STYLE = {
  Critical: 'status-critical',
  High:     'status-warning',
  Medium:   'status-info',
  Info:     'bg-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)]',
}

const PATH_BADGE_STYLE = {
  'Completed':   'status-active',
  'In Progress': 'status-warning',
  'Not Started': 'bg-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-dim)]',
}

const LEVEL_STYLE = {
  'Beginner':     'status-active',
  'Intermediate': 'status-warning',
  'All Levels':   'status-info',
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Ring (reused from Dashboard pattern)
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score, max = 100, color, size = 80, strokeWidth = 6, label }) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(score / max, 1)
  const dash = pct * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--color-soc-border-subtle)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dasharray 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-[var(--color-soc-text)] leading-none">{score}</span>
          <span className="text-[9px] text-[var(--color-soc-text-muted)] font-semibold">/{max}</span>
        </div>
      </div>
      {label && <p className="text-[10px] text-[var(--color-soc-text-muted)] text-center font-semibold">{label}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Component
// ─────────────────────────────────────────────────────────────────────────────

function SecurityQuiz() {
  const [current, setCurrent]   = useState(0)
  const [selected, setSelected] = useState(null)      // index of chosen option
  const [answers, setAnswers]   = useState([])         // array of { chosen, correct }
  const [revealed, setRevealed] = useState(false)
  const [done, setDone]         = useState(false)

  function handleSelect(idx) {
    if (revealed) return
    setSelected(idx)
  }

  function handleNext() {
    if (selected === null) return
    const q = QUIZ_QUESTIONS[current]
    const newAnswers = [...answers, { chosen: selected, correct: q.correct }]
    setAnswers(newAnswers)

    if (!revealed) { setRevealed(true); return }

    // Move to next
    if (current < QUIZ_QUESTIONS.length - 1) {
      setCurrent(current + 1)
      setSelected(null)
      setRevealed(false)
    } else {
      setDone(true)
    }
  }

  function handleRetake() {
    setCurrent(0); setSelected(null); setAnswers([]); setRevealed(false); setDone(false)
  }

  const score = answers.filter((a) => a.chosen === a.correct).length
  const q = QUIZ_QUESTIONS[current]
  const progressPct = ((current + (revealed ? 1 : 0)) / QUIZ_QUESTIONS.length) * 100

  if (done) {
    const pct = Math.round((score / QUIZ_QUESTIONS.length) * 100)
    const grade = pct >= 80 ? { label: 'Excellent', color: 'var(--color-soc-green)', glow: 'var(--color-soc-green-glow)', emoji: '🏆' }
      : pct >= 60 ? { label: 'Good', color: 'var(--color-soc-amber)', glow: 'var(--color-soc-amber-glow)', emoji: '👍' }
      : { label: 'Needs Work', color: 'var(--color-soc-red)', glow: 'var(--color-soc-red-glow)', emoji: '📚' }

    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <div className="text-4xl">{grade.emoji}</div>
        <ScoreRing score={pct} max={100} color={grade.color} size={120} strokeWidth={8} />
        <div className="text-center">
          <p className="text-lg font-black text-[var(--color-soc-text)]">
            {score} / {QUIZ_QUESTIONS.length} Correct
          </p>
          <p className="text-sm mt-1 font-bold" style={{ color: grade.color }}>{grade.label}</p>
          {pct < 80 && (
            <p className="text-xs text-[var(--color-soc-text-muted)] mt-2 max-w-xs">
              Score 80% or higher to earn your Security Awareness badge. Review the Learning Paths below and try again.
            </p>
          )}
        </div>

        {/* Per-question review */}
        <div className="w-full space-y-2 border-t border-[var(--color-soc-border-subtle)] pt-4">
          {QUIZ_QUESTIONS.map((qq, i) => {
            const ans = answers[i]
            const isRight = ans?.chosen === ans?.correct
            return (
              <div key={qq.id} className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${
                isRight ? 'bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.15)]' : 'bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.15)]'
              }`}>
                <span className={`font-black flex-shrink-0 mt-0.5 ${isRight ? 'text-[var(--color-soc-green)]' : 'text-[var(--color-soc-red)]'}`}>
                  {isRight ? '✓' : '✗'}
                </span>
                <div>
                  <p className="font-semibold text-[var(--color-soc-text)] leading-snug">Q{i + 1}: {qq.question.slice(0, 60)}…</p>
                  {!isRight && (
                    <p className="text-[10px] text-[var(--color-soc-text-muted)] mt-0.5">
                      Correct: {qq.options[qq.correct].slice(0, 60)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={handleRetake}
          className="w-full py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-bold text-[var(--color-soc-text)] hover:border-[var(--color-soc-accent)] hover:text-[var(--color-soc-accent)] transition-colors">
          Retake Quiz
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">
            Question {current + 1} of {QUIZ_QUESTIONS.length}
          </span>
          <span className="text-[10px] font-semibold text-[var(--color-soc-accent)]">
            {answers.filter((a) => a.chosen === a.correct).length} correct so far
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--color-soc-accent)] transition-all duration-500"
            style={{ width: `${progressPct}%`, boxShadow: '0 0 8px var(--color-soc-accent)' }} />
        </div>
      </div>

      {/* Question */}
      <div className="p-4 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)]">
        <p className="text-sm font-semibold text-[var(--color-soc-text)] leading-relaxed">{q.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((opt, idx) => {
          let cls = 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)] text-[var(--color-soc-text-muted)]'
          if (selected === idx && !revealed) cls = 'border-[var(--color-soc-accent)] bg-[var(--color-soc-accent-glow)] text-[var(--color-soc-accent)]'
          if (revealed) {
            if (idx === q.correct) cls = 'border-[var(--color-soc-green)] bg-[var(--color-soc-green-glow)] text-[var(--color-soc-green)]'
            else if (idx === selected && selected !== q.correct) cls = 'border-[var(--color-soc-red)] bg-[var(--color-soc-red-glow)] text-[var(--color-soc-red)]'
            else cls = 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)] text-[var(--color-soc-text-dim)] opacity-50'
          }

          return (
            <button key={idx} onClick={() => handleSelect(idx)}
              disabled={revealed}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${cls} ${!revealed ? 'hover:border-[var(--color-soc-accent)] hover:text-[var(--color-soc-accent)] cursor-pointer' : 'cursor-default'}`}>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                revealed && idx === q.correct ? 'border-[var(--color-soc-green)] text-[var(--color-soc-green)]'
                  : revealed && idx === selected && selected !== q.correct ? 'border-[var(--color-soc-red)] text-[var(--color-soc-red)]'
                  : selected === idx && !revealed ? 'border-[var(--color-soc-accent)] text-[var(--color-soc-accent)]'
                  : 'border-current'
              }`}>
                {revealed && idx === q.correct ? '✓' : revealed && idx === selected && selected !== q.correct ? '✗' : String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1 leading-relaxed">{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Explanation */}
      {revealed && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] fade-in">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-[var(--color-soc-accent)] leading-relaxed">{q.explanation}</p>
        </div>
      )}

      {/* CTA */}
      <button onClick={handleNext} disabled={selected === null}
        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] hover:opacity-90"
        style={{ boxShadow: selected !== null ? '0 0 16px var(--color-soc-accent-glow)' : 'none' }}>
        {!revealed
          ? 'Check Answer'
          : current < QUIZ_QUESTIONS.length - 1 ? 'Next Question →' : 'See Results 🏆'
        }
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SecurityAwarenessPage
// ─────────────────────────────────────────────────────────────────────────────

export default function SecurityAwarenessPage() {
  const [tipIndex, setTipIndex]         = useState(0)
  const [bookmarked, setBookmarked]     = useState(false)
  const [readArticles, setReadArticles] = useState(new Set())
  const [expandedPath, setExpandedPath] = useState(null)

  // Rotate tip automatically every 60s
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % DAILY_TIPS.length), 60000)
    return () => clearInterval(id)
  }, [])

  function prevTip() { setBookmarked(false); setTipIndex((i) => (i - 1 + DAILY_TIPS.length) % DAILY_TIPS.length) }
  function nextTip() { setBookmarked(false); setTipIndex((i) => (i + 1) % DAILY_TIPS.length) }

  const tip = DAILY_TIPS[tipIndex]

  // Aggregate metrics
  const totalModules    = LEARNING_PATHS.reduce((s, p) => s + p.modules, 0)
  const completedModules = LEARNING_PATHS.reduce((s, p) => s + p.completed, 0)
  const awarenessScore  = 78
  const riskLevel       = awarenessScore >= 80 ? 'Low' : awarenessScore >= 60 ? 'Medium' : 'High'
  const riskColor       = awarenessScore >= 80 ? 'var(--color-soc-green)' : awarenessScore >= 60 ? 'var(--color-soc-amber)' : 'var(--color-soc-red)'
  const streakDays      = 7

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">Security Awareness Center</h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
            Training · Quizzes · News · Learning Paths — build your security instincts
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
          <span className="text-base">🔥</span>
          <span className="text-xs font-bold text-[var(--color-soc-amber)]">{streakDays}-day</span>
          <span className="text-xs text-[var(--color-soc-text-muted)]">learning streak</span>
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Awareness Score */}
        <div className="col-span-2 sm:col-span-1 flex items-center gap-5 p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
          <ScoreRing score={awarenessScore} max={100} color="var(--color-soc-green)" size={72} strokeWidth={6} />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold">Awareness Score</p>
            <p className="text-2xl font-black text-[var(--color-soc-text)] mt-0.5">{awarenessScore}<span className="text-sm text-[var(--color-soc-text-muted)]">/100</span></p>
            <p className="text-xs text-[var(--color-soc-green)] font-semibold mt-0.5">Good standing</p>
          </div>
        </div>

        {/* Trainings Completed */}
        <div className="flex flex-col justify-between p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center text-lg">🎓</div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mt-3">Modules Completed</p>
            <p className="text-2xl font-black text-[var(--color-soc-text)] mt-0.5">
              {completedModules}<span className="text-sm text-[var(--color-soc-text-muted)]">/{totalModules}</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-soc-accent)]"
                style={{ width: `${(completedModules / totalModules) * 100}%`, boxShadow: '0 0 6px var(--color-soc-accent)' }} />
            </div>
          </div>
        </div>

        {/* Risk Level */}
        <div className="flex flex-col justify-between p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `color-mix(in srgb, ${riskColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${riskColor} 25%, transparent)` }}>
            🛡️
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mt-3">Risk Level</p>
            <p className="text-2xl font-black mt-0.5" style={{ color: riskColor }}>{riskLevel}</p>
            <p className="text-xs text-[var(--color-soc-text-muted)] mt-0.5">
              {riskLevel === 'Low' ? 'Keep it up!' : 'Complete more training'}
            </p>
          </div>
        </div>

        {/* Streak */}
        <div className="flex flex-col justify-between p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-amber-glow)] border border-[rgba(255,176,32,0.2)] flex items-center justify-center text-lg">🔥</div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mt-3">Day Streak</p>
            <p className="text-2xl font-black text-[var(--color-soc-amber)] mt-0.5">{streakDays}</p>
            <p className="text-xs text-[var(--color-soc-text-muted)] mt-0.5">consecutive days</p>
          </div>
        </div>
      </div>

      {/* ── Two-column: Tip + Quiz ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily Security Tip */}
        <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-4 h-4">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Daily Security Tip</h2>
                <p className="text-[10px] text-[var(--color-soc-text-muted)]">
                  {tipIndex + 1} of {DAILY_TIPS.length} · auto-rotates every minute
                </p>
              </div>
            </div>
            <button
              onClick={() => setBookmarked(!bookmarked)}
              title={bookmarked ? 'Bookmarked' : 'Bookmark'}
              className={`p-2 rounded-lg transition-colors ${bookmarked ? 'text-[var(--color-soc-amber)]' : 'text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-amber)]'}`}>
              <svg viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Category + emoji */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] flex items-center justify-center text-3xl flex-shrink-0">
                {tip.icon}
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-[var(--color-soc-accent)] border border-[rgba(0,212,255,0.3)] bg-[var(--color-soc-accent-glow)]">
                {tip.category}
              </span>
            </div>

            {/* Tip text */}
            <p className="text-sm text-[var(--color-soc-text)] leading-relaxed min-h-[72px]">{tip.tip}</p>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1.5">
              {DAILY_TIPS.map((_, i) => (
                <button key={i} onClick={() => { setTipIndex(i); setBookmarked(false) }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === tipIndex ? 'bg-[var(--color-soc-accent)] w-4' : 'bg-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-text-muted)]'}`}
                />
              ))}
            </div>

            {/* Prev / Next */}
            <div className="flex items-center gap-3">
              <button onClick={prevTip}
                className="flex-1 py-2 rounded-xl border border-[var(--color-soc-border-subtle)] text-xs font-semibold text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-accent)] hover:text-[var(--color-soc-accent)] transition-colors">
                ← Previous
              </button>
              <button onClick={nextTip}
                className="flex-1 py-2 rounded-xl border border-[var(--color-soc-border-subtle)] text-xs font-semibold text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-accent)] hover:text-[var(--color-soc-accent)] transition-colors">
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Security Quiz */}
        <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-amber-glow)] border border-[rgba(255,176,32,0.2)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-amber)" strokeWidth={2} className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Security Awareness Quiz</h2>
              <p className="text-[10px] text-[var(--color-soc-text-muted)]">{QUIZ_QUESTIONS.length} questions · score 80%+ for your badge</p>
            </div>
          </div>
          <div className="p-5">
            <SecurityQuiz />
          </div>
        </div>
      </div>

      {/* ── Learning Paths ── */}
      <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.2)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2} className="w-4 h-4">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Recommended Learning Paths</h2>
              <p className="text-[10px] text-[var(--color-soc-text-muted)]">{LEARNING_PATHS.filter(p => p.completed === p.modules).length} of {LEARNING_PATHS.length} paths completed</p>
            </div>
          </div>
          <span className="text-[10px] text-[var(--color-soc-text-dim)]">Click to expand</span>
        </div>

        <div className="divide-y divide-[var(--color-soc-border-subtle)]">
          {LEARNING_PATHS.map((path) => {
            const pct = path.modules === 0 ? 0 : Math.round((path.completed / path.modules) * 100)
            const isOpen = expandedPath === path.id

            return (
              <div key={path.id}>
                <button
                  onClick={() => setExpandedPath(isOpen ? null : path.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-soc-surface)] transition-colors text-left">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] flex items-center justify-center text-xl flex-shrink-0">
                    {path.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-[var(--color-soc-text)]">{path.title}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PATH_BADGE_STYLE[path.badge]}`}>
                        {path.badge}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: path.color, boxShadow: `0 0 6px ${path.color}` }} />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: path.color }}>
                        {pct}%
                      </span>
                      <span className="text-[10px] text-[var(--color-soc-text-dim)] flex-shrink-0">
                        {path.completed}/{path.modules} modules
                      </span>
                    </div>
                  </div>

                  {/* Duration + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-[var(--color-soc-text-muted)] hidden sm:block">{path.duration}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      className={`w-4 h-4 text-[var(--color-soc-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-5 pb-4 pl-[76px] fade-in">
                    <p className="text-xs text-[var(--color-soc-text-muted)] leading-relaxed mb-3">{path.description}</p>
                    <div className="flex items-center gap-3">
                      <button className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors text-[var(--color-soc-bg)]"
                        style={{ background: path.color, boxShadow: `0 0 12px ${path.color}40` }}>
                        {path.completed === 0 ? 'Start Path' : path.completed === path.modules ? 'Review Path' : 'Continue →'}
                      </button>
                      <span className="text-[10px] text-[var(--color-soc-text-dim)]">⏱ {path.duration}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Articles + News ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Articles — 2 cols */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-4 h-4">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
              </div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Security Awareness Articles</h2>
            </div>
            <span className="text-[10px] text-[var(--color-soc-text-muted)]">
              {readArticles.size}/{ARTICLES.length} read
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ARTICLES.map((art) => {
              const isRead = readArticles.has(art.id)
              return (
                <div key={art.id}
                  onClick={() => setReadArticles((prev) => { const n = new Set(prev); n.add(art.id); return n })}
                  className={`group flex flex-col gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 ${
                    isRead
                      ? 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)] opacity-70'
                      : 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] hover:border-[var(--color-soc-accent)]'
                  }`}>
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl">{art.icon}</span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_STYLE[art.level]}`}>{art.level}</span>
                      {isRead && (
                        <span className="text-[9px] font-bold text-[var(--color-soc-green)] border border-[rgba(0,255,136,0.3)] px-1.5 py-0.5 rounded-full">✓ Read</span>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: art.categoryBg, color: art.categoryColor, border: `1px solid ${art.categoryColor}33` }}>
                    {art.category}
                  </span>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-[var(--color-soc-text)] leading-snug group-hover:text-[var(--color-soc-accent)] transition-colors">
                    {art.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-[11px] text-[var(--color-soc-text-muted)] leading-relaxed flex-1">{art.summary}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--color-soc-border-subtle)]">
                    <span className="text-[10px] text-[var(--color-soc-text-dim)]">⏱ {art.readTime}</span>
                    <span className="text-[10px] font-semibold text-[var(--color-soc-accent)] group-hover:underline">
                      {isRead ? 'Re-read →' : 'Read →'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Security News */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.2)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-4 h-4">
                <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v2"/>
                <path d="M4 12H2v8a2 2 0 002 2h12"/>
                <line x1="12" y1="6" x2="20" y2="6"/><line x1="12" y1="10" x2="20" y2="10"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Recent Security News</h2>
              <p className="text-[10px] text-[var(--color-soc-text-muted)]">Threat intel · Advisories · Updates</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden flex-1">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-green)] animate-pulse" />
              <span className="text-[10px] font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">Live Feed — Demo Data</span>
            </div>

            <div className="divide-y divide-[var(--color-soc-border-subtle)]">
              {SECURITY_NEWS.map((news) => (
                <div key={news.id} className="flex flex-col gap-2 px-4 py-3.5 hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${NEWS_SEVERITY_STYLE[news.severity]}`}>
                      {news.severity}
                    </span>
                    <span className="text-[9px] text-[var(--color-soc-text-dim)] border border-[var(--color-soc-border-subtle)] rounded px-1.5 py-0.5 font-medium">
                      {news.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--color-soc-text)] leading-snug">{news.headline}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-soc-text-dim)]">
                    <span>{news.source}</span>
                    <span>·</span>
                    <span>{news.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)]">
              <p className="text-[10px] text-[var(--color-soc-text-dim)] text-center">
                Live threat intelligence feed — coming soon via SIEM integration
              </p>
            </div>
          </div>

          {/* Achievement badges */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] p-4">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-3">Your Badges</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { emoji: '🏆', label: 'Foundation', earned: true },
                { emoji: '🎣', label: 'Phishing Pro', earned: false },
                { emoji: '🔒', label: 'Zero Trust', earned: false },
                { emoji: '🚨', label: 'First Responder', earned: false },
                { emoji: '🔑', label: 'Password Guru', earned: false },
                { emoji: '☁️', label: 'Cloud Safe', earned: false },
                { emoji: '📋', label: 'Compliant', earned: false },
                { emoji: '🌟', label: 'Top Scorer', earned: false },
              ].map((badge) => (
                <div key={badge.label} title={badge.label}
                  className={`flex items-center justify-center h-10 rounded-xl text-xl border transition-all ${
                    badge.earned
                      ? 'border-[rgba(255,176,32,0.4)] bg-[var(--color-soc-amber-glow)]'
                      : 'border-[var(--color-soc-border-subtle)] opacity-30 grayscale'
                  }`}>
                  {badge.emoji}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-soc-text-dim)] text-center mt-3">
              1/8 badges earned · Complete paths to unlock more
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * MyActivityPage.jsx — Employee Activity Dashboard
 *
 * Design inspiration: Microsoft Defender + Viva Insights
 * Stack: React · Framer Motion · Lucide React · Pure SVG charts (no library needed)
 *
 * Sections:
 *  1. Hero card       — avatar, name, dept, security score ring, last AI interaction
 *  2. Stats cards     — IT Tickets · Password Resets · Incidents · Training
 *  3. Charts row      — Monthly AI Usage (bar) · Training Completion (donut) · Score Trend (line)
 *  4. Activity Timeline — chronological feed of all employee actions
 */

import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Ticket, Lock, ShieldAlert, BookOpen, Clock, Flame,
  CheckCircle2, AlertCircle, CircleDot, TrendingUp, Activity,
  Cpu, BarChart2, Calendar, Zap, ChevronRight, Award,
} from 'lucide-react'
import { getMyActivity } from '../api/myActivity'

// ─────────────────────────────────────────────────────────────────────────────
// Employee data (static — replace with auth context + API later)
// ─────────────────────────────────────────────────────────────────────────────

const EMPLOYEE = {
  name:       'John Doe',
  initials:   'JD',
  department: 'IT Department',
  role:       'Security Analyst',
  email:      'john.doe@corp.com',
  joinedDate: 'March 2022',
  securityScore: 82,
  lastAI:     '2 hours ago',
}

// Monthly AI interaction counts (Jan–Jun)
const AI_USAGE = [
  { month: 'Jan', count: 8  },
  { month: 'Feb', count: 14 },
  { month: 'Mar', count: 11 },
  { month: 'Apr', count: 19 },
  { month: 'May', count: 16 },
  { month: 'Jun', count: 23 },
]

// Security score per week (last 8 weeks)
const SCORE_TREND = [68, 71, 70, 74, 78, 76, 80, 82]

const TRAINING_COMPLETION = 58  // percent

// ─────────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
})

// Glass card shell
function GlassCard({ children, className = '', style = {}, hover = false }) {
  return (
    <div
      className={`rounded-2xl ${hover ? 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]' : ''} ${className}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
        ...style,
      }}>
      {children}
    </div>
  )
}

// Animated counter
function Counter({ target, suffix = '', duration = 1.2 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration * 60)
    const id = setInterval(() => {
      start = Math.min(start + step, target)
      setCount(Number.isInteger(target) ? Math.round(start) : +start.toFixed(1))
      if (start >= target) clearInterval(id)
    }, 1000 / 60)
    return () => clearInterval(id)
  }, [inView, target, duration])

  return <span ref={ref}>{count}{suffix}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Score Ring
// ─────────────────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#00ff88' : score >= 60 ? '#00d4ff' : '#ffb020'

  return (
    <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
      <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <motion.circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`0 ${circ}`}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{score}</span>
        <span className="text-[9px] text-white/30 font-semibold mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat mini-card (used in the 4 metric groups)
// ─────────────────────────────────────────────────────────────────────────────
function MiniStat({ label, value, color, suffix = '' }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl"
      style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 18%, transparent)` }}>
      <span className="text-xl font-black leading-none" style={{ color }}>
        <Counter target={typeof value === 'number' ? value : 0} suffix={suffix} />
      </span>
      <span className="text-[9px] text-white/35 font-semibold text-center leading-tight">{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Group card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, title, accent, children, delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)} className="h-full">
      <GlassCard hover className="p-5 h-full">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)` }}>
            <Icon size={15} style={{ color: accent }} />
          </div>
          <span className="text-[12px] font-bold text-white/80">{title}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {children}
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar Chart — Monthly AI Usage
// ─────────────────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.count))
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <div ref={ref} className="flex items-end justify-between gap-2 h-36 pt-4">
      {data.map((d, i) => {
        const heightPct = (d.count / maxVal) * 100
        return (
          <div key={d.month} className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-[10px] font-bold text-white/40">{d.count}</span>
            <div className="relative w-full rounded-t-lg overflow-hidden flex-1 flex items-end"
              style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px 6px 0 0' }}>
              <motion.div
                className="w-full rounded-t-md"
                initial={{ height: 0 }}
                animate={inView ? { height: `${heightPct}%` } : { height: 0 }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  background: i === data.length - 1
                    ? 'linear-gradient(180deg, #00d4ff 0%, #7850ff 100%)'
                    : 'linear-gradient(180deg, rgba(0,212,255,0.5) 0%, rgba(120,80,255,0.4) 100%)',
                  boxShadow: i === data.length - 1 ? '0 0 16px rgba(0,212,255,0.4)' : 'none',
                }}
              />
            </div>
            <span className="text-[9px] text-white/25 font-medium">{d.month}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Donut Chart — Training Completion
// ─────────────────────────────────────────────────────────────────────────────
function DonutChart({ pct }) {
  const r = 46
  const circ = 2 * Math.PI * r
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <div ref={ref} className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 120, height: 120 }}>
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          {/* Background arc segments */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(120,80,255,0.1)" strokeWidth="10"
            strokeDasharray={`${circ * 0.42} ${circ * 0.58}`} strokeLinecap="round" />
          {/* Completed arc */}
          <motion.circle
            cx="60" cy="60" r={r} fill="none"
            stroke="url(#donutGrad)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`0 ${circ}`}
            animate={inView ? { strokeDasharray: `${circ * (pct / 100)} ${circ}` } : {}}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
          <defs>
            <linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#7850ff" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{pct}%</span>
          <span className="text-[9px] text-white/30 font-semibold">Done</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'linear-gradient(135deg, #00d4ff, #7850ff)' }} />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/10" />
          Remaining
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Line Chart — Security Score Trend
// ─────────────────────────────────────────────────────────────────────────────
function LineChart({ data }) {
  const W = 280, H = 80
  const min = Math.min(...data) - 4
  const max = Math.max(...data) + 4
  const xStep = W / (data.length - 1)

  const pts = data.map((v, i) => ({
    x: i * xStep,
    y: H - ((v - min) / (max - min)) * H,
  }))

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

  // Area path
  const area = `M${pts[0].x},${H} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${H} Z`

  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const pathLen = useRef(null)

  const lineRef = useRef(null)
  useEffect(() => {
    if (lineRef.current) pathLen.current = lineRef.current.getTotalLength()
  }, [])

  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: 80 }}>
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#00ff88" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.path
          d={area} fill="url(#lineAreaGrad)"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Line */}
        <motion.polyline
          ref={lineRef}
          points={polyline}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
          style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.5))' }}
        />

        {/* Data points */}
        {pts.map((p, i) => (
          <motion.circle
            key={i} cx={p.x} cy={p.y} r="3" fill="#00ff88"
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
            style={{ filter: 'drop-shadow(0 0 3px #00ff88)' }}
          />
        ))}

        {/* Last point label */}
        <motion.text
          x={pts[pts.length - 1].x + 6} y={pts[pts.length - 1].y + 4}
          fontSize="10" fill="#00ff88" fontWeight="700"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 1.2 }}>
          {data[data.length - 1]}
        </motion.text>
      </svg>

      {/* Week labels */}
      <div className="flex justify-between mt-1">
        {data.map((_, i) => (
          <span key={i} className="text-[9px] text-white/20">W{i + 1}</span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Timeline Entry
// ─────────────────────────────────────────────────────────────────────────────
function TimelineEntry({ item, index, isLast }) {
  const Icon = item.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-4">

      {/* Spine */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center z-10"
          style={{ background: `color-mix(in srgb, ${item.color} 15%, rgba(10,12,24,1))`, border: `1.5px solid ${item.color}40` }}>
          <Icon size={12} style={{ color: item.color }} />
        </div>
        {!isLast && <div className="flex-1 w-px my-1" style={{ background: 'rgba(255,255,255,0.05)' }} />}
      </div>

      {/* Content */}
      <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] text-white/75 font-medium leading-snug">{item.label}</p>
          <span className="text-[10px] text-white/25 whitespace-nowrap font-medium flex-shrink-0 mt-0.5">{item.time}</span>
        </div>
        <span className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{ background: `color-mix(in srgb, ${item.color} 10%, transparent)`, color: item.color }}>
          {item.tag}
        </span>
      </div>
    </motion.div>
  )
}

const getActivityIcon = (type) => {
  if (type === 'incident') return { icon: ShieldAlert, color: '#ff3b5c', tag: 'Security Incident' }
  if (type === 'ticket') return { icon: Ticket, color: '#ffb020', tag: 'IT Ticket' }
  if (type === 'reset') return { icon: Lock, color: '#00ff88', tag: 'Password Reset' }
  return { icon: Activity, color: '#00d4ff', tag: 'Activity' }
}

const formatTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
  return `${Math.floor(diff / 86400000)} days ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function MyActivityPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchActivity = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMyActivity()
      setData(res)
    } catch (err) {
      setError(err.message || "Failed to load activity.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivity()
  }, [])

  const scoreColor = EMPLOYEE.securityScore >= 80 ? '#00ff88' : EMPLOYEE.securityScore >= 60 ? '#00d4ff' : '#ffb020'
  const scoreLabel = EMPLOYEE.securityScore >= 80 ? 'Excellent' : EMPLOYEE.securityScore >= 60 ? 'Good' : 'Needs Work'

  return (
    <div className="min-h-screen px-5 sm:px-8 py-8 max-w-[1200px] mx-auto" style={{ color: '#fff' }}>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/50 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-400" />
            <div>
              <p className="text-sm font-bold text-red-400">Connection Error</p>
              <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={fetchActivity} className="px-4 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500 hover:text-white transition-all">Retry</button>
        </div>
      )}

      {/* ── Page title ── */}
      <motion.div {...fadeUp(0)} className="mb-8">
        <div className="flex items-center gap-2 mb-1.5">
          <Activity size={16} className="text-cyan-400" />
          <span className="text-[11px] font-semibold text-cyan-400/60 uppercase tracking-[0.2em]">Employee Portal</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">My Activity</h1>
        <p className="text-[13px] text-white/35 mt-1">Your personal security and helpdesk summary at a glance.</p>
      </motion.div>

      {/* ══ HERO CARD ══════════════════════════════════════════════════════════ */}
      <motion.div {...fadeUp(0.05)} className="mb-6">
        <GlassCard style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(120,80,255,0.06) 50%, rgba(0,255,136,0.04) 100%)',
          border: '1px solid rgba(0,212,255,0.12)',
        }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff 0%, #7850ff 60%, #a855f7 100%)',
                  boxShadow: '0 0 30px rgba(0,212,255,0.3)',
                }}>
                {EMPLOYEE.initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#07080f] bg-[#00ff88]"
                style={{ boxShadow: '0 0 6px #00ff88' }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-white leading-none">{EMPLOYEE.name}</h2>
              <p className="text-[13px] text-white/50 mt-1">{EMPLOYEE.role} · {EMPLOYEE.department}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{EMPLOYEE.email}</p>

              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <Calendar size={11} className="text-white/25" />
                  Joined {EMPLOYEE.joinedDate}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <Cpu size={11} className="text-cyan-400/60" />
                  Last AI interaction: <span className="text-cyan-400/80 font-semibold ml-1">{EMPLOYEE.lastAI}</span>
                </div>
              </div>
            </div>

            {/* Score ring */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <ScoreRing score={EMPLOYEE.securityScore} />
              <div className="text-center">
                <p className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</p>
                <p className="text-[9px] text-white/25">Security Score</p>
              </div>
            </div>

            {/* Achievement badges */}
            <div className="flex flex-col gap-2 flex-shrink-0 hidden lg:flex">
              {[
                { emoji: '🏆', label: 'Foundation', earned: true },
                { emoji: '📱', label: 'Mobile Safe', earned: true },
                { emoji: '🔥', label: '7-Day Streak', earned: true },
                { emoji: '🎣', label: 'Phishing Pro', earned: false },
              ].map(b => (
                <div key={b.label}
                  title={b.label}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${b.earned ? '' : 'opacity-25 grayscale'}`}
                  style={b.earned ? { background: 'rgba(255,176,32,0.1)', border: '1px solid rgba(255,176,32,0.2)', color: '#ffb020' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                  <span>{b.emoji}</span>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ══ STAT CARDS ═════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white/5 border border-white/5 rounded-2xl h-[120px] animate-pulse p-5">
                <div className="w-8 h-8 rounded-xl bg-white/10 mb-4" />
                <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/3" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard icon={Ticket} title="IT Tickets" accent="#ffb020" delay={0.1}>
              <MiniStat label="Created"  value={data?.tickets_created || 0}  color="#00d4ff" />
              <MiniStat label="Resolved" value={0} color="#00ff88" />
              <MiniStat label="Pending"  value={0}  color="#ffb020" />
            </StatCard>

            <StatCard icon={Lock} title="Password Resets" accent="#00d4ff" delay={0.15}>
              <MiniStat label="Requested" value={data?.password_resets || 0} color="#00d4ff" />
              <MiniStat label="Completed" value={0} color="#00ff88" />
              <MiniStat label="Pending"   value={0} color="#ffb020" />
            </StatCard>

            <StatCard icon={ShieldAlert} title="Security Incidents" accent="#ff3b5c" delay={0.2}>
              <MiniStat label="Reported"  value={data?.incidents_reported || 0}  color="#00d4ff" />
              <MiniStat label="Resolved"  value={0}  color="#00ff88" />
              <MiniStat label="Escalated" value={0} color="#ff3b5c" />
            </StatCard>

            <StatCard icon={BookOpen} title="Training Progress" accent="#7850ff" delay={0.25}>
              <MiniStat label="Recommended" value={data?.training_recommendations || 0} color="#00d4ff" />
              <MiniStat label="Completed"   value={0} color="#00ff88" />
              <MiniStat label="Hours"       value={0} color="#7850ff" suffix="h" />
            </StatCard>
          </>
        )}
      </div>

      {/* ══ CHARTS ROW ═════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">

        {/* Monthly AI Usage — Bar Chart */}
        <motion.div {...fadeUp(0.3)} className="lg:col-span-1">
          <GlassCard className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[12px] font-bold text-white">Monthly AI Usage</p>
                <p className="text-[10px] text-white/30 mt-0.5">AI interactions per month</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00d4ff]">
                <TrendingUp size={12} />
                +44%
              </div>
            </div>
            <BarChart data={AI_USAGE} />
          </GlassCard>
        </motion.div>

        {/* Training Completion — Donut */}
        <motion.div {...fadeUp(0.35)}>
          <GlassCard className="p-5 h-full">
            <div className="mb-4">
              <p className="text-[12px] font-bold text-white">Training Completion</p>
              <p className="text-[10px] text-white/30 mt-0.5">7 of 12 modules finished</p>
            </div>
            <div className="flex flex-col items-center">
              <DonutChart pct={TRAINING_COMPLETION} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: 'Completed', val: 7, color: '#00d4ff' },
                { label: 'Remaining', val: 5, color: 'rgba(255,255,255,0.2)' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2 text-[10px] text-white/40">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  {r.val} {r.label}
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Security Score Trend — Line Chart */}
        <motion.div {...fadeUp(0.4)}>
          <GlassCard className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[12px] font-bold text-white">Security Score Trend</p>
                <p className="text-[10px] text-white/30 mt-0.5">Last 8 weeks</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black" style={{ color: scoreColor }}>{EMPLOYEE.securityScore}</p>
                <p className="text-[9px] text-white/30">Current</p>
              </div>
            </div>
            <LineChart data={SCORE_TREND} />

            {/* Score label row */}
            <div className="flex items-center justify-between mt-3 text-[10px] text-white/30">
              <span>Started: 68</span>
              <span className="flex items-center gap-1 font-semibold" style={{ color: '#00ff88' }}>
                <TrendingUp size={10} /> +{EMPLOYEE.securityScore - SCORE_TREND[0]} pts
              </span>
              <span>Now: {EMPLOYEE.securityScore}</span>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* ══ TIMELINE ═══════════════════════════════════════════════════════════ */}
      <motion.div {...fadeUp(0.45)}>
        <GlassCard className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                <Zap size={15} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-white">Recent Activity</h2>
                <p className="text-[10px] text-white/30 mt-0.5">Your recent actions</p>
              </div>
            </div>
            <button className="flex items-center gap-1 text-[11px] text-white/30 hover:text-cyan-400 transition-colors font-medium">
              View all <ChevronRight size={12} />
            </button>
          </div>

          {/* Entries */}
          {loading ? (
             <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-white/10" />
                    <div className="flex-1">
                      <div className="h-3 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-2 bg-white/10 rounded w-1/6" />
                    </div>
                  </div>
                ))}
             </div>
          ) : data?.recent_activity?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {data.recent_activity.map((item, i) => {
                const config = getActivityIcon(item.type)
                return (
                  <TimelineEntry
                    key={i}
                    item={{ ...item, label: item.title, time: formatTimeAgo(item.date), ...config }}
                    index={i}
                    isLast={i >= data.recent_activity.length - 2}
                  />
                )
              })}
            </div>
          ) : (
            <div className="py-8 flex items-center justify-center">
              <span className="text-sm text-white/40">No activity found.</span>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Bottom spacer */}
      <div className="h-10" />
    </div>
  )
}

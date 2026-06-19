import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const routeLabels = {
  '/':                    'Home',
  '/dashboard':           'Dashboard',
  '/incidents':           'Incident Response',
  '/soc':                 'SOC Assistant',
  '/it-support':          'IT Support',
  '/password-reset':      'Password Reset',
  '/security-awareness':  'Security Training',
}

const breadcrumbBase = 'CyberShield AI'

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export default function Navbar({ onMenuClick }) {
  const location = useLocation()
  const [time, setTime] = useState(formatTime(new Date()))
  const [notifications, setNotifications] = useState(5)
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const currentPage = routeLabels[location.pathname] || 'Unknown'

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(interval)
  }, [])

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-btn')) {
        setShowNotifPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const demoNotifications = [
    { id: 1, text: 'Critical alert: Brute force on SSH', time: '2m ago', level: 'critical' },
    { id: 2, text: 'Ticket #5821 awaiting approval', time: '8m ago', level: 'warning' },
    { id: 3, text: 'AI resolved 3 password resets', time: '15m ago', level: 'info' },
    { id: 4, text: 'SIEM performance degraded', time: '32m ago', level: 'warning' },
    { id: 5, text: 'Patch cycle completed on 47 nodes', time: '1h ago', level: 'success' },
  ]

  const levelColor = {
    critical: 'var(--color-soc-red)',
    warning: 'var(--color-soc-amber)',
    info: 'var(--color-soc-accent)',
    success: 'var(--color-soc-green)',
  }

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 px-4 lg:px-6 h-16
                 bg-[var(--color-soc-surface)]/95 backdrop-blur-md
                 border-b border-[var(--color-soc-border-subtle)]"
    >
      {/* Mobile menu button */}
      <button
        id="sidebar-menu-btn"
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] hover:bg-[var(--color-soc-card)] transition-colors"
        aria-label="Open sidebar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--color-soc-text-muted)] hidden sm:inline">{breadcrumbBase}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-[var(--color-soc-text-dim)] hidden sm:block">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="font-semibold text-[var(--color-soc-text)]">{currentPage}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live threat ticker */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-red)] animate-pulse flex-shrink-0" />
        <span className="text-xs text-[var(--color-soc-text-muted)] font-mono">THREAT LVL:</span>
        <span className="text-xs font-bold text-[var(--color-soc-red)]">ELEVATED</span>
      </div>

      {/* Live clock */}
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-[var(--color-soc-accent)]">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="text-xs font-mono text-[var(--color-soc-accent)] tracking-wider">{time}</span>
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          id="notif-btn"
          onClick={() => {
            setShowNotifPanel(!showNotifPanel)
            if (!showNotifPanel) setNotifications(0)
          }}
          className="relative p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] hover:bg-[var(--color-soc-card)] transition-colors"
          aria-label="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {notifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-[var(--color-soc-red)] text-white flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        {/* Notifications panel */}
        {showNotifPanel && (
          <div
            id="notif-panel"
            className="absolute right-0 top-12 w-80 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border)] shadow-2xl fade-in z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-soc-border-subtle)]">
              <span className="text-sm font-semibold text-[var(--color-soc-text)]">Alerts & Notifications</span>
              <span className="text-[10px] text-[var(--color-soc-text-muted)]">Mark all read</span>
            </div>
            <ul className="divide-y divide-[var(--color-soc-border-subtle)] max-h-72 overflow-y-auto">
              {demoNotifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer">
                  <span
                    className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: levelColor[n.level], boxShadow: `0 0 6px ${levelColor[n.level]}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-soc-text)] leading-snug">{n.text}</p>
                    <p className="text-[10px] text-[var(--color-soc-text-muted)] mt-0.5">{n.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* User avatar */}
      <div className="flex items-center gap-2.5 pl-2 border-l border-[var(--color-soc-border-subtle)]">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-soc-accent)] to-[var(--color-soc-purple)] flex items-center justify-center text-xs font-bold text-[var(--color-soc-bg)]">
          SA
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-[var(--color-soc-text)] leading-tight">SOC Admin</p>
          <p className="text-[10px] text-[var(--color-soc-text-muted)]">Tier 2 Analyst</p>
        </div>
      </div>
    </header>
  )
}

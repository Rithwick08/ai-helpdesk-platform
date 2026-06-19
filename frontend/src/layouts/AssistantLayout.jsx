import { useState } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'

export default function AssistantLayout() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-soc-bg)] grid-bg">

      {/* ── Top nav bar ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-soc-accent)] flex items-center justify-center glow-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="#050b14" strokeWidth={2.5} className="w-4 h-4">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-[var(--color-soc-text)]">CyberShield</span>
              <span className="text-[10px] text-[var(--color-soc-text-muted)] ml-1.5 tracking-wider uppercase">AI</span>
            </div>
          </Link>

          {/* Center label */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-green)] animate-pulse" />
              <span className="text-xs font-semibold text-[var(--color-soc-text)]">AI Assistant</span>
              <span className="text-[10px] text-[var(--color-soc-text-muted)] hidden sm:inline">· Employee Portal</span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Status */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[var(--color-soc-green)] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-green)] animate-pulse" />
              AI ONLINE
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--color-soc-card)] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-soc-purple)] to-[var(--color-soc-accent)] flex items-center justify-center text-xs font-bold text-white">
                  JD
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-[var(--color-soc-text)] leading-tight">John Doe</p>
                  <p className="text-[10px] text-[var(--color-soc-text-muted)]">Employee · IT Dept</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-[var(--color-soc-text-muted)] hidden sm:block">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 w-44 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border)] shadow-2xl fade-in z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-soc-border-subtle)]">
                    <p className="text-xs font-semibold text-[var(--color-soc-text)]">John Doe</p>
                    <p className="text-[10px] text-[var(--color-soc-text-muted)]">john.doe@corp.com</p>
                  </div>
                  <ul className="py-1">
                    <li>
                      <button className="w-full text-left px-4 py-2 text-xs text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)] transition-colors">
                        My Profile
                      </button>
                    </li>
                    <li>
                      <button className="w-full text-left px-4 py-2 text-xs text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)] transition-colors">
                        Settings
                      </button>
                    </li>
                    <li className="border-t border-[var(--color-soc-border-subtle)] mt-1 pt-1">
                      <button
                        onClick={() => navigate('/')}
                        className="w-full text-left px-4 py-2 text-xs text-[var(--color-soc-red)] hover:bg-[var(--color-soc-red-glow)] transition-colors"
                      >
                        Sign Out
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--color-soc-border-subtle)] px-4 py-3 text-center text-[10px] text-[var(--color-soc-text-dim)]">
        CyberShield AI Platform · Employee Portal · All activity is monitored and logged
      </footer>
    </div>
  )
}

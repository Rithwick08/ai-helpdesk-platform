import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'incidents',
    label: 'Incident Response',
    path: '/incidents',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    badge: 14,
  },
  {
    id: 'soc',
    label: 'SOC Assistant',
    path: '/soc',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    id: 'it-support',
    label: 'IT Support',
    path: '/it-support',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
        <polyline points="7.5 19.79 7.5 14.6 3 12" />
        <polyline points="21 12 16.5 14.6 16.5 19.79" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'password-reset',
    label: 'Password Reset',
    path: '/password-reset',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    id: 'security-awareness',
    label: 'Security Training',
    path: '/security-awareness',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
]

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  // Close mobile drawer on route change
  useEffect(() => {
    if (onClose) onClose()
  }, [location.pathname])

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'bg-[var(--color-soc-surface)] border-r border-[var(--color-soc-border-subtle)]',
          'transition-all duration-300 ease-in-out',
          // Desktop collapsed/expanded
          collapsed ? 'w-16' : 'w-64',
          // Mobile: slide in/out
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--color-soc-border-subtle)]">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-soc-accent)] flex items-center justify-center glow-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="#050b14" strokeWidth={2.5} className="w-5 h-5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="pulse-dot absolute -top-1 -right-1" />
          </div>

          {!collapsed && (
            <div className="slide-in-left overflow-hidden">
              <p className="text-sm font-bold text-[var(--color-soc-text)] leading-tight">
                CyberShield
              </p>
              <p className="text-[10px] text-[var(--color-soc-text-muted)] tracking-widest uppercase">
                AI Platform
              </p>
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex p-1 rounded text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              {collapsed
                ? <path d="M9 18l6-6-6-6" />
                : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        {/* Section label */}
        {!collapsed && (
          <p className="px-4 pt-5 pb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-soc-text-dim)] font-semibold">
            Navigation
          </p>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) =>
                    [
                      'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                      'transition-all duration-150 relative overflow-hidden',
                      isActive
                        ? 'bg-[var(--color-soc-accent-glow)] text-[var(--color-soc-accent)] border border-[rgba(0,212,255,0.2)]'
                        : 'text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-card)]',
                    ].join(' ')
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active left bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-soc-accent)] rounded-r" />
                      )}
                      <span className={isActive ? 'text-[var(--color-soc-accent)]' : ''}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-soc-red)] text-white min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer — system status */}
        <div className="p-3 border-t border-[var(--color-soc-border-subtle)]">
          {collapsed ? (
            <div className="flex justify-center">
              <span className="pulse-dot" />
            </div>
          ) : (
            <div className="px-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="pulse-dot flex-shrink-0" />
                <span className="text-xs text-[var(--color-soc-green)] font-medium">All Systems Nominal</span>
              </div>
              <p className="text-[10px] text-[var(--color-soc-text-dim)]">Last sync: just now</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

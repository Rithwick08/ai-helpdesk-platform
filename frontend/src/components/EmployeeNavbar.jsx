/**
 * EmployeeNavbar.jsx
 *
 * Premium fixed navigation bar for the CyberDesk Employee Portal.
 *
 * Stack: React · Tailwind CSS · Framer Motion · Lucide React · React Router NavLink
 *
 * Layout:
 *   LEFT   — CyberDesk logo + wordmark
 *   CENTER — Animated nav links with glowing active indicator (Framer Motion layoutId)
 *   RIGHT  — AI status pill · Avatar + employee name · Dropdown (Profile / Settings / Logout)
 */

import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic2,
  ShieldCheck,
  BarChart3,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Cpu,
} from 'lucide-react'

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/assistant',          label: 'AI Core',             icon: Mic2,         emoji: '🎙' },
  { to: '/security',           label: 'Security Awareness',  icon: ShieldCheck,  emoji: '🛡' },
  { to: '/my-activity',        label: 'My Activity',         icon: BarChart3,    emoji: '📊' },
]

// ── Framer variants ───────────────────────────────────────────────────────────
const dropdownVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.96, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, y: -6, scale: 0.97, filter: 'blur(2px)',
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

const itemVariants = {
  hidden:  { opacity: 0, x: -6 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.05, duration: 0.18, ease: 'easeOut' },
  }),
}

// ── DropdownItem ─────────────────────────────────────────────────────────────
function DropdownItem({ icon: Icon, label, onClick, danger = false, index }) {
  return (
    <motion.button
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium',
        'rounded-xl transition-colors duration-150 text-left',
        danger
          ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
          : 'text-white/60 hover:text-white hover:bg-white/6',
      ].join(' ')}>
      <Icon size={14} className="flex-shrink-0 opacity-70" />
      {label}
    </motion.button>
  )
}

// ── Main EmployeeNavbar ───────────────────────────────────────────────────────
export default function EmployeeNavbar() {
  const [dropOpen, setDropOpen]   = useState(false)
  const navigate                  = useNavigate()
  const dropRef                   = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false)
    }
    if (dropOpen) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [dropOpen])

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setDropOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-[60px] flex items-center px-6 gap-6"
      style={{
        background: 'rgba(7, 8, 15, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 40px rgba(0,0,0,0.4)',
      }}>

      {/* ══ LEFT — Logo ══════════════════════════════════════════════════════ */}
      <NavLink to="/assistant" className="flex items-center gap-2.5 flex-shrink-0 group">
        {/* Icon mark */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(120,80,255,0.25) 100%)',
            border: '1px solid rgba(0,212,255,0.35)',
            boxShadow: '0 0 16px rgba(0,212,255,0.2)',
          }}>
          <Cpu size={16} className="text-cyan-400" />
        </div>

        {/* Wordmark */}
        <div className="hidden sm:flex flex-col leading-none">
          <span className="text-[13px] font-bold text-white tracking-tight">CyberDesk</span>
          <span
            className="text-[9px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: 'rgba(0,212,255,0.5)' }}>
            AI Command Centre
          </span>
        </div>
      </NavLink>

      {/* ══ CENTER — Nav links ════════════════════════════════════════════════ */}
      <nav className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1 relative">
          {NAV_ITEMS.map(({ to, label, icon: Icon, emoji }) => (
            <NavLink key={to} to={to} end className="relative">
              {({ isActive }) => (
                <div className="relative group">
                  {/* Active background glow pill */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-bg"
                      className="absolute inset-0 rounded-xl"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(120,80,255,0.08) 100%)',
                        border: '1px solid rgba(0,212,255,0.2)',
                      }}
                    />
                  )}

                  {/* Link content */}
                  <div
                    className={[
                      'relative flex items-center gap-2 px-4 py-2 rounded-xl',
                      'text-[13px] font-semibold transition-colors duration-200 select-none',
                      isActive
                        ? 'text-cyan-300'
                        : 'text-white/40 hover:text-white/80',
                    ].join(' ')}>

                    {/* Icon */}
                    <Icon
                      size={14}
                      className={[
                        'flex-shrink-0 transition-all duration-200',
                        isActive
                          ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(0,212,255,0.7)]'
                          : 'opacity-60 group-hover:opacity-90',
                      ].join(' ')}
                    />

                    {/* Label */}
                    <span>{label}</span>

                    {/* Active dot indicator */}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-dot"
                        className="w-1 h-1 rounded-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        style={{
                          background: '#00d4ff',
                          boxShadow: '0 0 6px rgba(0,212,255,0.8)',
                        }}
                      />
                    )}
                  </div>

                  {/* Animated underline */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-3 right-3 h-[1.5px] rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      style={{
                        background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
                        boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                      }}
                    />
                  )}

                  {/* Hover underline (non-active) */}
                  {!isActive && (
                    <motion.div
                      className="absolute bottom-0 left-3 right-3 h-[1px] rounded-full origin-center"
                      initial={{ scaleX: 0, opacity: 0 }}
                      whileHover={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      style={{ background: 'rgba(255,255,255,0.15)' }}
                    />
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ══ RIGHT — Status + Avatar ═══════════════════════════════════════════ */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* AI Online status pill */}
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold"
          style={{
            background: 'rgba(0,255,136,0.07)',
            border: '1px solid rgba(0,255,136,0.18)',
            color: '#00ff88',
          }}>
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#00ff88', boxShadow: '0 0 4px #00ff88' }}
          />
          AI Online
        </div>

        {/* Avatar + Dropdown */}
        <div ref={dropRef} className="relative">
          <motion.button
            id="employee-avatar-btn"
            onClick={() => setDropOpen(!dropOpen)}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2.5 p-1.5 rounded-xl transition-colors duration-150 hover:bg-white/5"
            style={{ border: '1px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>

            {/* Avatar circle */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #7850ff 100%)',
                boxShadow: '0 0 12px rgba(0,212,255,0.3)',
              }}>
              JD
            </div>

            {/* Name + role */}
            <div className="hidden sm:flex flex-col text-left leading-none">
              <span className="text-[12px] font-semibold text-white/90">John Doe</span>
              <span className="text-[10px] text-white/35 mt-0.5">Employee</span>
            </div>

            {/* Chevron */}
            <motion.div
              animate={{ rotate: dropOpen ? 180 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}>
              <ChevronDown size={13} className="text-white/30 hidden sm:block" />
            </motion.div>
          </motion.button>

          {/* ── Dropdown ── */}
          <AnimatePresence>
            {dropOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 top-[calc(100%+8px)] w-52 rounded-2xl p-1.5 z-50"
                style={{
                  background: 'rgba(10, 12, 24, 0.96)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(0,212,255,0.1)',
                  backdropFilter: 'blur(24px)',
                }}>

                {/* User info header */}
                <div
                  className="px-4 py-3 mb-1 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #7850ff 100%)' }}>
                      JD
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">John Doe</p>
                      <p className="text-[10px] text-white/35 truncate">john.doe@corp.com</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px mx-2 mb-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

                {/* Menu items */}
                <DropdownItem
                  icon={User}
                  label="Profile"
                  index={0}
                  onClick={() => { setDropOpen(false) }}
                />
                <DropdownItem
                  icon={Settings}
                  label="Settings"
                  index={1}
                  onClick={() => { setDropOpen(false) }}
                />

                {/* Divider before logout */}
                <div className="h-px mx-2 my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

                <DropdownItem
                  icon={LogOut}
                  label="Logout"
                  danger
                  index={2}
                  onClick={() => { setDropOpen(false); navigate('/') }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

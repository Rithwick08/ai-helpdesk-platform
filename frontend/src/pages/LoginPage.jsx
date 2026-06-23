import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ShieldIcon = ({cls}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const EyeIcon = ({cls}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = ({cls}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}>
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const MailIcon = ({cls}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const LockIcon = ({cls}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={cls}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [emailError, setEmailError]     = useState('')
  const [passError, setPassError]       = useState('')
  const [authError, setAuthError]       = useState('')

  function validate() {
    let ok = true
    setEmailError('')
    setPassError('')
    setAuthError('')
    
    if (!email.trim()) { setEmailError('Email is required'); ok = false }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Enter a valid email address'); ok = false }
    if (!password) { setPassError('Password is required'); ok = false }
    else if (password.length < 6) { setPassError('Password must be at least 6 characters'); ok = false }
    return ok
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const result = await login(email, password)
    setLoading(false)

    if (result.success) {
      // Check if there was an intended destination
      const from = location.state?.from?.pathname
      
      if (from && from !== '/login') {
        navigate(from, { replace: true })
      } else {
        // Auto-redirect based on role
        const role = result.user.role
        switch (role) {
          case 'admin':    navigate('/dashboard', { replace: true }); break;
          case 'employee': navigate('/assistant', { replace: true }); break;
          case 'it':       navigate('/it-support', { replace: true }); break;
          case 'soc':      navigate('/soc', { replace: true }); break;
          default:         navigate('/', { replace: true }); break;
        }
      }
    } else {
      setAuthError(result.message)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-soc-bg)] grid-bg flex flex-col">

      {/* Background glow */}
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-[var(--color-soc-accent)] opacity-[0.035] blur-[150px]" />

      {/* Top nav */}
      <nav className="relative z-10 px-4 sm:px-8 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-accent)] flex items-center justify-center glow-accent">
            <ShieldIcon cls="w-5 h-5 stroke-[#050b14]" />
          </div>
          <div>
            <span className="text-base font-black text-[var(--color-soc-text)]">CyberShield</span>
            <span className="text-[10px] text-[var(--color-soc-accent)] ml-1.5 font-bold tracking-widest uppercase">AI</span>
          </div>
        </Link>
        <Link to="/" className="text-sm text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] transition-colors flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back to home
        </Link>
      </nav>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">

          {/* ── Login form ── */}
          <div className="rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden fade-in">

            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-[var(--color-soc-border-subtle)]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.25)] flex items-center justify-center">
                  <ShieldIcon cls="w-5 h-5 text-[var(--color-soc-accent)]" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-[var(--color-soc-text)]">Secure Login</h1>
                  <p className="text-[11px] text-[var(--color-soc-text-muted)] tracking-wider uppercase mt-0.5">CyberShield AI Platform</p>
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.15)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-[10px] text-[var(--color-soc-green)]">256-bit encrypted · Zero-trust verified · Activity logged</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="px-8 py-6 space-y-5">
              
              {authError && (
                <div className="p-3 bg-[var(--color-soc-red)] bg-opacity-10 border border-[var(--color-soc-red)] rounded-xl text-center">
                  <p className="text-xs text-[var(--color-soc-red)]">{authError}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <MailIcon cls="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-soc-text-dim)]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                    placeholder="you@company.com"
                    className={[
                      'w-full pl-10 pr-4 py-3 rounded-xl text-sm',
                      'bg-[var(--color-soc-surface)] text-[var(--color-soc-text)]',
                      'border transition-all outline-none',
                      'placeholder:text-[var(--color-soc-text-dim)]',
                      emailError
                        ? 'border-[var(--color-soc-red)] focus:border-[var(--color-soc-red)]'
                        : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]',
                    ].join(' ')}
                  />
                </div>
                {emailError && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{emailError}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">
                    Password
                  </label>
                  <button type="button" className="text-[11px] text-[var(--color-soc-accent)] hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <LockIcon cls="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-soc-text-dim)]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPassError('') }}
                    placeholder="Enter your password"
                    className={[
                      'w-full pl-10 pr-12 py-3 rounded-xl text-sm',
                      'bg-[var(--color-soc-surface)] text-[var(--color-soc-text)]',
                      'border transition-all outline-none',
                      'placeholder:text-[var(--color-soc-text-dim)]',
                      passError
                        ? 'border-[var(--color-soc-red)] focus:border-[var(--color-soc-red)]'
                        : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]',
                    ].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-soc-text-dim)] hover:text-[var(--color-soc-text-muted)] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon cls="w-4 h-4" /> : <EyeIcon cls="w-4 h-4" />}
                  </button>
                </div>
                {passError && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{passError}</p>}
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={[
                    'w-4.5 h-4.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-all',
                    rememberMe
                      ? 'bg-[var(--color-soc-accent)] border-[var(--color-soc-accent)]'
                      : 'bg-transparent border-[var(--color-soc-border)] group-hover:border-[var(--color-soc-accent)]',
                  ].join(' ')}
                >
                  {rememberMe && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#050b14" strokeWidth={3} className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[var(--color-soc-text-muted)]">Remember me on this device</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] font-bold text-sm
                           hover:opacity-90 transition-opacity glow-accent flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#050b14]"></span>
                ) : (
                  <ShieldIcon cls="w-4 h-4 stroke-[#050b14]" />
                )}
                {loading ? 'Authenticating...' : 'Sign In Securely'}
              </button>

              <p className="text-center text-[11px] text-[var(--color-soc-text-muted)]">
                Protected by zero-trust security · All sessions encrypted
              </p>
            </form>
          </div>
        </div>
      </div>

    </div>
  )
}

/**
 * PasswordResetPage.jsx
 *
 * Password Reset Management for the Admin / SOC portal.
 *
 * Workflow: Request → Verify OTP → AI Analysis → Pending Approval → Approved → Completed
 *
 * APIs:
 *  GET  /password-resets              → table
 *  POST /password-resets              → create request (returns OTP)
 *  POST /password-resets/verify       → submit OTP
 *  PUT  /password-resets/{id}/approve → admin approve
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPasswordResets,
  createPasswordReset,
  verifyOTP,
  approvePasswordReset,
} from '../api/passwordResetService'
import { SkeletonRow } from '../components/Skeletons'
import ErrorBanner from '../components/ErrorBanner'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  'All',
  'Pending Verification',
  'Pending Approval',
  'Approved',
  'Completed',
]

const STATUS_STYLES = {
  'Pending Verification': 'status-warning',
  'Pending Approval':     'status-critical',
  'Approved':             'status-active',
  'Completed':            'status-info',
}

const STATUS_COLORS = {
  'Pending Verification': 'var(--color-soc-amber)',
  'Pending Approval':     'var(--color-soc-red)',
  'Approved':             'var(--color-soc-green)',
  'Completed':            'var(--color-soc-accent)',
}

const PRIORITY_STYLES = {
  Critical: 'status-critical',
  High:     'status-warning',
  Medium:   'status-info',
  Low:      'status-active',
}

// Workflow steps definition — matches backend status progression
const WORKFLOW_STEPS = [
  { key: 'request',     label: 'Request Submitted',   status: 'Pending Verification' },
  { key: 'verify',      label: 'Identity Verified',   status: 'Pending Approval' },
  { key: 'analysis',    label: 'AI Analysis Complete', status: 'Pending Approval' },
  { key: 'approval',    label: 'Admin Approval',       status: 'Approved' },
  { key: 'completed',   label: 'Reset Executed',       status: 'Completed' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtId(id) { return `PWR-${String(id).padStart(5, '0')}` }

/** Map a status to how many workflow steps are "done" */
function stepsCompleted(status) {
  if (status === 'Pending Verification') return 0
  if (status === 'Pending Approval')     return 2
  if (status === 'Approved')             return 3
  if (status === 'Completed')            return 5
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLES[status] || 'status-info'}`}>
      {status || '—'}
    </span>
  )
}

function PriorityBadge({ level }) {
  if (!level) return <span className="text-[var(--color-soc-text-muted)] text-xs">—</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PRIORITY_STYLES[level] || 'status-info'}`}>
      {level}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Timeline (inside drawer)
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowTimeline({ status }) {
  const done = stepsCompleted(status)
  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[var(--color-soc-border-subtle)]" />
      <ol className="space-y-4 relative">
        {WORKFLOW_STEPS.map((step, i) => {
          const isCompleted = i < done
          const isCurrent   = i === done && status !== 'Completed'
          const isPending   = i > done

          return (
            <li key={step.key} className="flex items-start gap-3.5">
              {/* Step dot */}
              <div className={[
                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2',
                isCompleted
                  ? 'bg-[var(--color-soc-green)] border-[var(--color-soc-green)]'
                  : isCurrent
                    ? 'bg-transparent border-[var(--color-soc-accent)] shadow-[0_0_8px_var(--color-soc-accent)]'
                    : 'bg-[var(--color-soc-surface)] border-[var(--color-soc-border-subtle)]',
              ].join(' ')}
              style={{ marginTop: '2px' }}>
                {isCompleted && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-accent)] animate-pulse" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0 pb-1">
                <p className={[
                  'text-xs font-semibold leading-snug',
                  isCompleted ? 'text-[var(--color-soc-green)]'
                    : isCurrent ? 'text-[var(--color-soc-accent)]'
                    : 'text-[var(--color-soc-text-dim)]',
                ].join(' ')}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-[10px] text-[var(--color-soc-accent)] mt-0.5 opacity-80">In progress…</p>
                )}
                {isCompleted && i === done - 1 && (
                  <p className="text-[10px] text-[var(--color-soc-green)] mt-0.5 opacity-70">Most recent</p>
                )}
              </div>

              {/* Status tag for completed steps */}
              {isCompleted && (
                <span className="text-[9px] font-bold text-[var(--color-soc-green)] border border-[rgba(0,255,136,0.3)] px-1.5 py-0.5 rounded flex-shrink-0">
                  ✓ Done
                </span>
              )}
              {isPending && (
                <span className="text-[9px] font-medium text-[var(--color-soc-text-dim)] flex-shrink-0">Pending</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

function ResetDrawer({ reset, onClose, onApproved }) {
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState('')

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  async function handleApprove() {
    setApproving(true)
    setApproveError('')
    try {
      const result = await approvePasswordReset(reset.id)
      onApproved(reset.id, result.status, result.action_taken)
      onClose()
    } catch (err) {
      setApproveError(err.message || 'Failed to approve reset request.')
    } finally {
      setApproving(false)
    }
  }

  const canApprove = reset.status === 'Pending Approval' && reset.identity_verified === 'Yes'

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 fade-in" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col
                   bg-[var(--color-soc-surface)] border-l border-[var(--color-soc-border-subtle)] shadow-2xl"
        style={{ animation: 'slideInRight 0.28s ease-out forwards' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs text-[var(--color-soc-accent)]">{fmtId(reset.id)}</span>
              <StatusBadge status={reset.status} />
            </div>
            <h2 className="text-base font-bold text-[var(--color-soc-text)]">
              Password Reset — {reset.employee_id}
            </h2>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-card)] transition-colors flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Approve error */}
          {approveError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-[var(--color-soc-red)]">{approveError}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Employee ID',        value: <span className="font-mono text-[var(--color-soc-accent)] text-xs">{reset.employee_id}</span> },
              { label: 'Status',             value: <StatusBadge status={reset.status} /> },
              { label: 'Priority',           value: <PriorityBadge level={reset.priority} /> },
              { label: 'Identity Verified',  value: (
                <span className={`text-xs font-bold ${reset.identity_verified === 'Yes' ? 'text-[var(--color-soc-green)]' : 'text-[var(--color-soc-amber)]'}`}>
                  {reset.identity_verified === 'Yes' ? '✓ Verified' : '✗ Not Verified'}
                </span>
              )},
              { label: 'Requested',         value: <span className="font-mono text-[10px]">{fmtDate(reset.created_at)}</span> },
              { label: 'OTP',               value: (
                <span className="font-mono text-xs text-[var(--color-soc-text-muted)]">
                  {reset.identity_verified === 'Yes' ? '●●●●●● (used)' : reset.otp || '—'}
                </span>
              )},
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1.5">{label}</p>
                <div>{value}</div>
              </div>
            ))}
          </div>

          {/* Reason */}
          <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-2">
              Reset Reason
            </p>
            <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">
              {reset.reason || 'No reason provided.'}
            </p>
          </div>

          {/* AI Action Taken */}
          {reset.action_taken && (
            <div className="p-4 rounded-xl bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2} className="w-4 h-4">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.22-6.78-1.42 1.42M6.64 17.36l-1.42 1.42M17.36 17.36l-1.42-1.42M6.64 6.64 5.22 5.22"/>
                </svg>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-green)] font-bold">AI Recommended Action</p>
              </div>
              <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">{reset.action_taken}</p>
            </div>
          )}

          {/* Workflow Timeline */}
          <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center gap-2 mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-muted)" strokeWidth={2} className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold">Workflow Status</p>
            </div>
            <WorkflowTimeline status={reset.status} />
          </div>

          {/* Approve action hint */}
          {reset.status === 'Pending Approval' && reset.identity_verified !== 'Yes' && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-amber-glow)] border border-[rgba(255,176,32,0.2)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-amber)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-xs text-[var(--color-soc-amber)]">Identity must be verified before this request can be approved.</p>
            </div>
          )}
        </div>

        {/* Footer — Approve button */}
        {canApprove && (
          <div className="px-6 py-4 border-t border-[var(--color-soc-border-subtle)]">
            <button
              id={`approve-btn-${reset.id}`}
              onClick={handleApprove}
              disabled={approving}
              className="w-full py-3 rounded-xl bg-[var(--color-soc-green)] text-[var(--color-soc-bg)] font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 20px var(--color-soc-green-glow)' }}
            >
              {approving ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Approving Reset…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Approve Password Reset
                </>
              )}
            </button>
            <p className="text-[10px] text-[var(--color-soc-text-dim)] text-center mt-2">
              This will execute the reset and mark the request as Completed
            </p>
          </div>
        )}
        {reset.status === 'Completed' && (
          <div className="px-6 py-4 border-t border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.2)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2.5} className="w-4 h-4">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-sm font-bold text-[var(--color-soc-green)]">Reset Completed</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Reset Request Modal  (3-step: form → OTP → success)
// ─────────────────────────────────────────────────────────────────────────────

function CreateResetModal({ onClose, onCreated }) {
  const [step, setStep]             = useState('form')   // 'form' | 'otp' | 'done'
  const [employeeId, setEmployeeId] = useState('')
  const [reason, setReason]         = useState('')
  const [otp, setOtp]               = useState('')
  const [requestId, setRequestId]   = useState(null)
  const [generatedOtp, setGeneratedOtp] = useState(null)  // returned by backend (demo)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const firstRef = useRef(null)

  useEffect(() => { firstRef.current?.focus() }, [step])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, submitting])

  function validateForm() {
    const e = {}
    if (!employeeId.trim()) e.employeeId = 'Employee ID is required'
    if (!reason.trim()) e.reason = 'Reason is required'
    else if (reason.trim().length < 10) e.reason = 'Provide at least 10 characters'
    setFieldErrors(e)
    return !Object.keys(e).length
  }

  async function handleFormSubmit(ev) {
    ev.preventDefault()
    if (!validateForm()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await createPasswordReset({ employee_id: employeeId.trim(), reason: reason.trim() })
      setRequestId(res.request_id)
      setGeneratedOtp(res.otp)   // backend returns OTP in dev mode
      setStep('otp')
    } catch (err) {
      setError(err.message || 'Failed to create reset request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOtpSubmit(ev) {
    ev.preventDefault()
    if (!otp.trim()) { setError('Please enter the OTP'); return }
    setSubmitting(true)
    setError('')
    try {
      await verifyOTP(requestId, otp.trim())
      onCreated()
      setStep('done')
    } catch (err) {
      setError(err.message || 'OTP verification failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = 'w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-soc-surface)] text-[var(--color-soc-text)] border outline-none transition-all placeholder:text-[var(--color-soc-text-dim)]'

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 fade-in" onClick={() => !submitting && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] shadow-2xl fade-in overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.25)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={1.8} className="w-5 h-5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-soc-text)]">
                  {step === 'form' ? 'New Password Reset Request'
                    : step === 'otp' ? 'Verify Identity'
                    : 'Request Submitted'}
                </h2>
                <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
                  {step === 'form' ? 'Step 1 of 2 — Submit request'
                    : step === 'otp' ? 'Step 2 of 2 — Enter OTP'
                    : 'Pending admin approval'}
                </p>
              </div>
            </div>
            <button onClick={() => !submitting && onClose()} disabled={submitting}
              className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)] transition-colors disabled:opacity-40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Step progress bar */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              {['Request', 'Verify OTP', 'Approved'].map((label, i) => {
                const idx = step === 'form' ? 0 : step === 'otp' ? 1 : 2
                return (
                  <div key={label} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center gap-1.5 ${i <= idx ? 'text-[var(--color-soc-accent)]' : 'text-[var(--color-soc-text-dim)]'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 flex-shrink-0 ${
                        i < idx ? 'bg-[var(--color-soc-green)] border-[var(--color-soc-green)] text-white'
                          : i === idx ? 'border-[var(--color-soc-accent)] text-[var(--color-soc-accent)]'
                          : 'border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-dim)]'
                      }`}>
                        {i < idx ? '✓' : i + 1}
                      </div>
                      <span className="text-[10px] font-semibold hidden sm:block">{label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-0.5 rounded-full ${i < idx ? 'bg-[var(--color-soc-green)]' : 'bg-[var(--color-soc-border-subtle)]'}`} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-[var(--color-soc-red)]">{error}</p>
            </div>
          )}

          {/* ── Step: Form ── */}
          {step === 'form' && (
            <form onSubmit={handleFormSubmit} noValidate className="px-6 py-5 space-y-4">
              <div>
                <label htmlFor="emp-id" className="block text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">
                  Employee ID <span className="text-[var(--color-soc-red)]">*</span>
                </label>
                <input id="emp-id" ref={firstRef} type="text" value={employeeId}
                  onChange={(e) => { setEmployeeId(e.target.value); setFieldErrors((p) => ({ ...p, employeeId: '' })) }}
                  placeholder="e.g. EMP-10042"
                  disabled={submitting}
                  className={`${inputBase} ${fieldErrors.employeeId ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
                />
                {fieldErrors.employeeId && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{fieldErrors.employeeId}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="reset-reason" className="text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">
                    Reset Reason <span className="text-[var(--color-soc-red)]">*</span>
                  </label>
                  <span className={`text-[10px] tabular-nums ${reason.length < 10 ? 'text-[var(--color-soc-text-dim)]' : 'text-[var(--color-soc-green)]'}`}>
                    {reason.length} chars
                  </span>
                </div>
                <textarea id="reset-reason" rows={4} value={reason}
                  onChange={(e) => { setReason(e.target.value); setFieldErrors((p) => ({ ...p, reason: '' })) }}
                  placeholder="e.g. Forgot password after returning from 2-week leave. Last login was from company laptop."
                  disabled={submitting}
                  className={`${inputBase} resize-none ${fieldErrors.reason ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
                />
                {fieldErrors.reason && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{fieldErrors.reason}</p>}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-border)] transition-colors disabled:opacity-40">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting
                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Sending…</>
                    : 'Send OTP →'
                  }
                </button>
              </div>
            </form>
          )}

          {/* ── Step: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} noValidate className="px-6 py-5 space-y-4">
              {/* Dev helper — show OTP returned by backend */}
              {generatedOtp && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-soc-amber-glow)] border border-[rgba(255,176,32,0.25)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-amber)" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    <p className="text-[10px] text-[var(--color-soc-amber)] font-bold uppercase tracking-wider">Demo — OTP from backend</p>
                    <p className="font-mono text-lg font-black text-[var(--color-soc-amber)] tracking-[0.3em] mt-0.5">{generatedOtp}</p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="otp-input" className="block text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">
                  Enter OTP <span className="text-[var(--color-soc-red)]">*</span>
                </label>
                <input id="otp-input" ref={firstRef} type="text" inputMode="numeric" maxLength={6}
                  value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="6-digit code"
                  disabled={submitting}
                  className={`${inputBase} text-center text-2xl font-mono tracking-[0.4em] border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]`}
                />
                <p className="text-[10px] text-[var(--color-soc-text-muted)] text-center mt-1.5">
                  OTP sent to employee's registered email · Request ID: {fmtId(requestId)}
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep('form'); setOtp(''); setError('') }} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-border)] transition-colors disabled:opacity-40">
                  ← Back
                </button>
                <button type="submit" disabled={submitting || otp.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-soc-green)] text-[var(--color-soc-bg)] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting
                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Verifying…</>
                    : 'Verify Identity'
                  }
                </button>
              </div>
            </form>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="px-6 py-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.25)] mx-auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2.5} className="w-7 h-7">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-soc-text)]">Identity Verified</h3>
                <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
                  AI has analysed the request and set priority. The request is now <strong className="text-[var(--color-soc-amber)]">Pending Approval</strong>.
                </p>
              </div>
              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text)] hover:border-[var(--color-soc-accent)] transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PasswordResetPage
// ─────────────────────────────────────────────────────────────────────────────

export default function PasswordResetPage() {
  const [resets, setResets]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [errorDismissed, setErrDismiss] = useState(false)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchResets = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrDismiss(false)
    try {
      const data = await getPasswordResets()
      setResets(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (err) {
      setError(err.message || 'Failed to load password reset requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchResets() }, [fetchResets])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = resets.filter((r) => {
    const matchSearch = !search || r.employee_id?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  // Status counts
  const statusCounts = resets.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  // Pending approval queue
  const pendingApproval = resets.filter((r) => r.status === 'Pending Approval' && r.identity_verified === 'Yes')

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleApproved(id, newStatus, newAction) {
    setResets((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: newStatus, action_taken: newAction } : r)
    )
    setSelected((prev) => prev?.id === id ? { ...prev, status: newStatus, action_taken: newAction } : prev)
  }

  function handleCreated() { fetchResets() }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">Password Resets</h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
            AI-verified identity checks · Admin-controlled approval workflow
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-red)] animate-pulse" />
              <span className="text-xs font-mono text-[var(--color-soc-text-muted)]">
                <span className="text-[var(--color-soc-red)] font-bold">{pendingApproval.length}</span>{' '}awaiting approval
                {' · '}
                <span className="text-[var(--color-soc-text)] font-bold">{resets.length}</span> total
              </span>
            </div>
          )}

          <button onClick={fetchResets} disabled={loading} title="Refresh"
            className="p-2 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] hover:border-[var(--color-soc-accent)] transition-all disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>

          <button id="create-reset-btn" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] text-sm font-bold hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 16px var(--color-soc-accent-glow)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Request
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && !errorDismissed && (
        <ErrorBanner message={error} onRetry={() => { setErrDismiss(false); fetchResets() }} onDismiss={() => setErrDismiss(true)} />
      )}

      {/* ── Pending Approval Queue ── */}
      {!loading && pendingApproval.length > 0 && (
        <div className="rounded-xl border border-[rgba(255,59,92,0.3)] bg-[var(--color-soc-card)] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-[var(--color-soc-red-glow)] border-b border-[rgba(255,59,92,0.2)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-soc-red)] animate-pulse flex-shrink-0" />
            <p className="text-sm font-bold text-[var(--color-soc-red)]">
              Pending Approval Queue — {pendingApproval.length} request{pendingApproval.length !== 1 ? 's' : ''} require admin action
            </p>
          </div>
          <div className="divide-y divide-[var(--color-soc-border-subtle)]">
            {pendingApproval.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--color-soc-surface)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[var(--color-soc-accent)]">{fmtId(r.id)}</span>
                    <span className="text-sm font-semibold text-[var(--color-soc-text)]">{r.employee_id}</span>
                    <PriorityBadge level={r.priority} />
                  </div>
                  <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5 truncate">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setSelected(r)}
                    className="text-xs text-[var(--color-soc-accent)] font-medium hover:underline px-2">
                    View
                  </button>
                  <button
                    id={`queue-approve-${r.id}`}
                    onClick={async () => {
                      try {
                        const res = await approvePasswordReset(r.id)
                        handleApproved(r.id, res.status, res.action_taken)
                      } catch { /* handled silently; user can open drawer for details */ }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-soc-green)] text-[var(--color-soc-bg)] text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Status summary pills ── */}
      {!loading && resets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.filter((s) => s !== 'All').map((s) => {
            const count = statusCounts[s] || 0
            if (!count) return null
            return (
              <button key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? 'border-current bg-opacity-10'
                    : 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] text-[var(--color-soc-text-muted)] hover:border-current'
                }`}
                style={{ color: STATUS_COLORS[s], borderColor: statusFilter === s ? STATUS_COLORS[s] : undefined }}>
                <StatusBadge status={s} />
                <span className="font-bold text-[10px] tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Search + Status filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-soc-text-dim)]">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="reset-search" type="search" placeholder="Search by Employee ID..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] placeholder:text-[var(--color-soc-text-dim)] outline-none focus:border-[var(--color-soc-accent)] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} style={{ background: 'var(--color-soc-card)' }}>
              {s === 'All' ? 'All Statuses' : s}
            </option>
          ))}
        </select>

        {(search || statusFilter !== 'All') && (
          <button onClick={() => { setSearch(''); setStatusFilter('All') }}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-soc-amber)] border border-[rgba(255,176,32,0.3)] hover:bg-[var(--color-soc-amber-glow)] transition-colors whitespace-nowrap">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-soc-text)]">All Reset Requests</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} request${filtered.length !== 1 ? 's' : ''}${filtered.length !== resets.length ? ` (filtered from ${resets.length})` : ''}`}
            </p>
          </div>
          {!loading && resets.length > 0 && (
            <span className="text-[9px] text-[var(--color-soc-green)] border border-[var(--color-soc-green)] rounded px-1.5 py-0.5 font-bold tracking-wider">
              LIVE DATA
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-soc-border-subtle)]">
                {['ID', 'Employee ID', 'Priority', 'Verified', 'Status', 'Action Taken', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : filtered.length > 0
                  ? filtered.map((r) => (
                      <tr key={r.id}
                        onClick={() => setSelected(r)}
                        className="border-b border-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer group">
                        <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] whitespace-nowrap group-hover:underline">
                          {fmtId(r.id)}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text)] font-semibold whitespace-nowrap">
                          {r.employee_id}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PriorityBadge level={r.priority} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold ${r.identity_verified === 'Yes' ? 'text-[var(--color-soc-green)]' : 'text-[var(--color-soc-amber)]'}`}>
                            {r.identity_verified === 'Yes' ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] max-w-[180px]">
                          <span className="block truncate">{r.action_taken || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap font-mono text-[10px]">
                          {fmtDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {r.status === 'Pending Approval' && r.identity_verified === 'Yes' && (
                            <span className="text-[10px] text-[var(--color-soc-red)] font-bold opacity-80 group-hover:opacity-100">
                              Approve →
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={8} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[var(--color-soc-border-subtle)] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-dim)" strokeWidth={1.5} className="w-6 h-6">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-soc-text-muted)]">
                              {resets.length === 0 ? 'No reset requests yet' : 'No matching requests'}
                            </p>
                            <p className="text-xs text-[var(--color-soc-text-dim)] mt-1">
                              {resets.length === 0 ? 'Create the first request using the button above' : 'Try adjusting your search or filters'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--color-soc-border-subtle)] flex items-center justify-between text-[10px] text-[var(--color-soc-text-muted)]">
            <span>Click any row to view details, workflow timeline &amp; approve</span>
            <span>{filtered.length} of {resets.length} shown</span>
          </div>
        )}
      </div>

      {/* ── Modals / Drawer ── */}
      {showCreate && (
        <CreateResetModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {selected && (
        <ResetDrawer
          reset={selected}
          onClose={() => setSelected(null)}
          onApproved={handleApproved}
        />
      )}
    </div>
  )
}

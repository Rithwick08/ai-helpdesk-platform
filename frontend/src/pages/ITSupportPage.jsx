/**
 * ITSupportPage.jsx
 *
 * IT Support ticket management for the Admin / SOC portal.
 *
 * Features:
 *  - GET  /it-tickets              → ticket table with search + priority + status filters
 *  - POST /it-tickets              → create modal (title + description, AI-diagnosed)
 *  - GET  /ticket-history/{id}     → timeline inside detail drawer
 *  - PUT  /it-tickets/{id}/resolve → resolve action
 *  - PUT  /it-tickets/{id}/escalate→ escalate action
 *  - PUT  /it-tickets/{id}/close   → close action (only if Resolved)
 *  - SkeletonRow loading, ErrorBanner on failure
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getITTickets,
  createITTicket,
  resolveTicket,
  escalateTicket,
  closeTicket,
  getTicketHistory,
} from '../api/itTicketService'
import { SkeletonRow } from '../components/Skeletons'
import ErrorBanner from '../components/ErrorBanner'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_LEVELS  = ['All', 'Critical', 'High', 'Medium', 'Low']
const STATUS_OPTIONS   = ['All', 'In Progress', 'Open', 'Resolved', 'Escalated', 'Closed']

const PRIORITY_STYLES = {
  Critical: 'status-critical',
  High:     'status-warning',
  Medium:   'status-info',
  Low:      'status-active',
}

const STATUS_STYLES = {
  'Open':        'status-info',
  'In Progress': 'status-warning',
  'Resolved':    'status-active',
  'Escalated':   'status-critical',
  'Closed':      'bg-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)]',
}

const PRIORITY_DOT = {
  Critical: 'var(--color-soc-red)',
  High:     'var(--color-soc-amber)',
  Medium:   'var(--color-soc-accent)',
  Low:      'var(--color-soc-green)',
}

const HISTORY_COLORS = {
  'Ticket Created':               { dot: 'var(--color-soc-accent)',  bg: 'var(--color-soc-accent-glow)' },
  'User Marked Issue Resolved':   { dot: 'var(--color-soc-green)',   bg: 'var(--color-soc-green-glow)' },
  'User Reported Issue Not Fixed':{ dot: 'var(--color-soc-red)',     bg: 'var(--color-soc-red-glow)' },
  'Ticket Closed':                { dot: 'var(--color-soc-text-muted)', bg: 'var(--color-soc-border-subtle)' },
  default:                        { dot: 'var(--color-soc-amber)',   bg: 'var(--color-soc-amber-glow)' },
}

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

function fmtId(id) { return `TKT-${String(id).padStart(5, '0')}` }

function parseSteps(raw) {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) return parsed
    return [String(parsed)]
  } catch {
    return String(raw)
      .replace(/^\[|\]$/g, '')
      .split(/,(?=\s*['"])/g)
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function PriorityBadge({ level }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PRIORITY_STYLES[level] || 'status-info'}`}>
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: PRIORITY_DOT[level] || 'currentColor' }} />
      {level || '—'}
    </span>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[status] || 'status-info'}`}>
      {status || '—'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

function TicketDrawer({ ticket, onClose, onStatusChange }) {
  const [history, setHistory]         = useState([])
  const [histLoading, setHistLoading] = useState(true)
  const [actionBusy, setActionBusy]   = useState(null) // 'resolve' | 'escalate' | 'close'
  const [actionError, setActionError] = useState('')

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch history whenever ticket changes
  useEffect(() => {
    setHistLoading(true)
    setHistory([])
    getTicketHistory(ticket.id)
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false))
  }, [ticket.id])

  const steps = parseSteps(ticket.resolution_steps)

  async function handleAction(type) {
    setActionBusy(type)
    setActionError('')
    try {
      let updated
      if (type === 'resolve')  updated = await resolveTicket(ticket.id)
      if (type === 'escalate') updated = await escalateTicket(ticket.id)
      if (type === 'close')    updated = await closeTicket(ticket.id)
      onStatusChange(ticket.id, updated?.status)
      // Refresh history
      const h = await getTicketHistory(ticket.id)
      setHistory(Array.isArray(h) ? h : [])
    } catch (err) {
      setActionError(err.message || `Failed to ${type} ticket`)
    } finally {
      setActionBusy(null)
    }
  }

  const canResolve  = !['Resolved', 'Closed'].includes(ticket.status)
  const canEscalate = !['Escalated', 'Closed'].includes(ticket.status)
  const canClose    = ticket.status === 'Resolved'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 fade-in" onClick={onClose} />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col
                   bg-[var(--color-soc-surface)] border-l border-[var(--color-soc-border-subtle)]
                   shadow-2xl"
        style={{ animation: 'slideInRight 0.28s ease-out forwards' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs text-[var(--color-soc-accent)]">{fmtId(ticket.id)}</span>
              <PriorityBadge level={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <h2 className="text-base font-bold text-[var(--color-soc-text)] leading-snug">{ticket.title}</h2>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-card)] transition-colors flex-shrink-0"
            aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Action error */}
          {actionError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-[var(--color-soc-red)]">{actionError}</p>
            </div>
          )}

          {/* Quick status / date */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status',   value: <StatusBadge status={ticket.status} /> },
              { label: 'Priority', value: <PriorityBadge level={ticket.priority} /> },
              { label: 'Category', value: ticket.category || 'Analysing…' },
              { label: 'Created',  value: <span className="font-mono text-[10px]">{fmtDate(ticket.created_at)}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1.5">{label}</p>
                <div className="text-xs text-[var(--color-soc-text)] font-medium">{value}</div>
              </div>
            ))}
          </div>

          {/* AI Diagnosis */}
          {ticket.diagnosis && (
            <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <div className="flex items-center gap-2 mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={1.8} className="w-4 h-4 flex-shrink-0">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.22-6.78-1.42 1.42M6.64 17.36l-1.42 1.42M17.36 17.36l-1.42-1.42M6.64 6.64 5.22 5.22"/>
                </svg>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-accent)] font-bold">AI Diagnosis</p>
              </div>
              <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">{ticket.diagnosis}</p>
            </div>
          )}

          {/* Recommended Fix */}
          {ticket.recommended_fix && (
            <div className="p-4 rounded-xl bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-green)] font-bold">Recommended Fix</p>
              </div>
              <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">{ticket.recommended_fix}</p>
            </div>
          )}

          {/* Resolution Steps */}
          {steps.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <div className="flex items-center gap-2 mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-amber)" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-amber)] font-bold">Resolution Steps</p>
              </div>
              <ol className="space-y-2.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-soc-amber-glow)] border border-[rgba(255,176,32,0.3)] flex items-center justify-center text-[10px] font-bold text-[var(--color-soc-amber)] flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Description */}
          {ticket.description && (
            <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-2">Description</p>
              <p className="text-sm text-[var(--color-soc-text)] leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* History Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-muted)" strokeWidth={2} className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold">Ticket History</p>
            </div>

            {histLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="shimmer w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="shimmer h-2.5 rounded w-2/3" />
                      <div className="shimmer h-2 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-[var(--color-soc-text-dim)] italic">No history entries found</p>
            ) : (
              <ol className="relative border-l border-[var(--color-soc-border-subtle)] ml-1.5 space-y-4">
                {history.map((entry, i) => {
                  const colors = HISTORY_COLORS[entry.action] || HISTORY_COLORS.default
                  return (
                    <li key={entry.id ?? i} className="ml-5">
                      <span
                        className="absolute -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-[var(--color-soc-surface)]"
                        style={{ background: colors.dot }}
                      />
                      <div className="p-3 rounded-xl" style={{ background: colors.bg, border: `1px solid ${colors.dot}22` }}>
                        <p className="text-xs font-semibold text-[var(--color-soc-text)]">{entry.action}</p>
                        {entry.timestamp && (
                          <p className="text-[10px] text-[var(--color-soc-text-muted)] mt-0.5 font-mono">{fmtDate(entry.timestamp)}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[var(--color-soc-border-subtle)] space-y-2">
          <p className="text-[9px] uppercase tracking-widest text-[var(--color-soc-text-dim)] mb-2">Actions</p>
          <div className="grid grid-cols-3 gap-2">
            {/* Resolve */}
            <button
              onClick={() => handleAction('resolve')}
              disabled={!canResolve || actionBusy !== null}
              className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border border-[rgba(0,255,136,0.3)] bg-[var(--color-soc-green-glow)] text-[var(--color-soc-green)] text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {actionBusy === 'resolve'
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>
              }
              Resolve
            </button>

            {/* Escalate */}
            <button
              onClick={() => handleAction('escalate')}
              disabled={!canEscalate || actionBusy !== null}
              className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border border-[rgba(255,59,92,0.3)] bg-[var(--color-soc-red-glow)] text-[var(--color-soc-red)] text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {actionBusy === 'escalate'
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
              }
              Escalate
            </button>

            {/* Close */}
            <button
              onClick={() => handleAction('close')}
              disabled={!canClose || actionBusy !== null}
              className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border border-[var(--color-soc-border)] bg-[var(--color-soc-card)] text-[var(--color-soc-text-muted)] text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              title={!canClose ? 'Ticket must be Resolved before closing' : ''}
            >
              {actionBusy === 'close'
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
              }
              Close
            </button>
          </div>
          {!canClose && ticket.status !== 'Closed' && (
            <p className="text-[10px] text-[var(--color-soc-text-dim)] text-center">
              Close becomes available after ticket is Resolved
            </p>
          )}
        </div>
      </aside>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Ticket Modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateTicketModal({ onClose, onCreated }) {
  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors]         = useState({})
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, submitting])

  function validate() {
    const e = {}
    if (!title.trim()) e.title = 'Title is required'
    if (!description.trim()) e.description = 'Description is required'
    else if (description.trim().length < 20) e.description = 'Provide at least 20 characters for AI diagnosis'
    setErrors(e)
    return !Object.keys(e).length
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await createITTicket({ title: title.trim(), description: description.trim() })
      onCreated(result)
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Failed to create ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = 'w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-soc-surface)] text-[var(--color-soc-text)] border outline-none transition-all placeholder:text-[var(--color-soc-text-dim)]'

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 fade-in" onClick={() => !submitting && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] shadow-2xl fade-in overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-amber-glow)] border border-[rgba(255,176,32,0.25)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-amber)" strokeWidth={1.8} className="w-5 h-5">
                  <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-soc-text)]">Create IT Support Ticket</h2>
                <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">AI will diagnose and set priority automatically</p>
              </div>
            </div>
            <button onClick={() => !submitting && onClose()} disabled={submitting}
              className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)] transition-colors disabled:opacity-40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">

            {submitError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs text-[var(--color-soc-red)]">{submitError}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="tkt-title" className="block text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">
                Issue Title <span className="text-[var(--color-soc-red)]">*</span>
              </label>
              <input id="tkt-title" ref={titleRef} type="text" value={title}
                onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })) }}
                placeholder="e.g. VPN keeps disconnecting every 10 minutes"
                disabled={submitting}
                className={`${inputBase} ${errors.title ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
              />
              {errors.title && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="tkt-desc" className="text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">
                  Problem Description <span className="text-[var(--color-soc-red)]">*</span>
                </label>
                <span className={`text-[10px] tabular-nums ${description.length < 20 ? 'text-[var(--color-soc-text-dim)]' : 'text-[var(--color-soc-green)]'}`}>
                  {description.length} chars
                </span>
              </div>
              <textarea id="tkt-desc" rows={5} value={description}
                onChange={(e) => { setDesc(e.target.value); setErrors((p) => ({ ...p, description: '' })) }}
                placeholder="Describe the issue in detail — what happened, when it started, what you've already tried, which systems are affected. The AI uses this to diagnose the root cause."
                disabled={submitting}
                className={`${inputBase} resize-none ${errors.description ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
              />
              {errors.description && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{errors.description}</p>}
            </div>

            {/* AI note */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.15)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[10px] text-[var(--color-soc-accent)] leading-relaxed">
                The AI engine will automatically assign <strong>category</strong>, <strong>priority</strong>, <strong>diagnosis</strong>, <strong>recommended fix</strong>, and step-by-step <strong>resolution steps</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => !submitting && onClose()} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:border-[var(--color-soc-border)] transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-soc-amber)] text-[var(--color-soc-bg)] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 20px var(--color-soc-amber-glow)' }}>
                {submitting ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Sending to AI...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Create Ticket
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ITSupportPage
// ─────────────────────────────────────────────────────────────────────────────

export default function ITSupportPage() {
  const [tickets, setTickets]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [errorDismissed, setErrDismiss] = useState(false)

  const [search, setSearch]             = useState('')
  const [priorityFilter, setPriority]   = useState('All')
  const [statusFilter, setStatus]       = useState('All')

  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrDismiss(false)
    try {
      const data = await getITTickets()
      setTickets(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (err) {
      setError(err.message || 'Failed to load IT tickets from backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = tickets.filter((t) => {
    const matchSearch   = !search || t.title?.toLowerCase().includes(search.toLowerCase())
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter
    const matchStatus   = statusFilter   === 'All' || t.status   === statusFilter
    return matchSearch && matchPriority && matchStatus
  })

  // Priority counts
  const priorityCounts = tickets.reduce((acc, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1
    return acc
  }, {})

  // ── Status change from drawer actions ──────────────────────────────────────
  function handleStatusChange(id, newStatus) {
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t))
    setSelected((prev) => prev?.id === id ? { ...prev, status: newStatus } : prev)
  }

  // ── After create ───────────────────────────────────────────────────────────
  function handleCreated() { fetchTickets() }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">IT Support</h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
            AI-diagnosed helpdesk tickets · Real-time resolution tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live stats */}
          {!loading && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-amber)] animate-pulse" />
              <span className="text-xs font-mono text-[var(--color-soc-text-muted)]">
                <span className="text-[var(--color-soc-amber)] font-bold">
                  {tickets.filter((t) => t.status === 'In Progress').length}
                </span>{' '}in progress
                {' · '}
                <span className="text-[var(--color-soc-red)] font-bold">
                  {tickets.filter((t) => t.status === 'Escalated').length}
                </span>{' '}escalated
                {' · '}
                <span className="text-[var(--color-soc-text)] font-bold">{tickets.length}</span> total
              </span>
            </div>
          )}

          {/* Refresh */}
          <button onClick={fetchTickets} disabled={loading} title="Refresh tickets"
            className="p-2 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] hover:border-[var(--color-soc-accent)] transition-all disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>

          {/* Create */}
          <button id="create-ticket-btn" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-soc-amber)] text-[var(--color-soc-bg)] text-sm font-bold hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 16px var(--color-soc-amber-glow)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Ticket
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && !errorDismissed && (
        <ErrorBanner
          message={error}
          onRetry={() => { setErrDismiss(false); fetchTickets() }}
          onDismiss={() => setErrDismiss(true)}
        />
      )}

      {/* ── Priority summary cards ── */}
      {!loading && tickets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { level: 'Critical', color: 'var(--color-soc-red)',    glow: 'var(--color-soc-red-glow)' },
            { level: 'High',     color: 'var(--color-soc-amber)',  glow: 'var(--color-soc-amber-glow)' },
            { level: 'Medium',   color: 'var(--color-soc-accent)', glow: 'var(--color-soc-accent-glow)' },
            { level: 'Low',      color: 'var(--color-soc-green)',  glow: 'var(--color-soc-green-glow)' },
          ].map(({ level, color }) => (
            <button key={level}
              onClick={() => setPriority(priorityFilter === level ? 'All' : level)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                priorityFilter === level
                  ? 'border-current bg-[var(--color-soc-card)]'
                  : 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] hover:border-current'
              }`}
              style={{ color }}>
              <span className="text-2xl font-black tabular-nums" style={{ color }}>{priorityCounts[level] || 0}</span>
              <div>
                <p className="text-xs font-bold" style={{ color }}>{level}</p>
                <p className="text-[10px] text-[var(--color-soc-text-dim)]">priority</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Status quick-filter row ── */}
      {!loading && tickets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.filter((s) => s !== 'All').map((s) => {
            const count = tickets.filter((t) => t.status === s).length
            if (!count) return null
            return (
              <button key={s}
                onClick={() => setStatus(statusFilter === s ? 'All' : s)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? 'border-[var(--color-soc-accent)] bg-[var(--color-soc-accent-glow)] text-[var(--color-soc-accent)]'
                    : 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-accent)]'
                }`}>
                <StatusBadge status={s} />
                <span className="tabular-nums font-bold text-[10px]">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Search & filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-soc-text-dim)]">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="ticket-search" type="search" placeholder="Search by title..."
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

        <select id="priority-filter" value={priorityFilter} onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer">
          {PRIORITY_LEVELS.map((p) => (
            <option key={p} value={p} style={{ background: 'var(--color-soc-card)' }}>
              {p === 'All' ? 'All Priorities' : p}
            </option>
          ))}
        </select>

        <select id="status-filter" value={statusFilter} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} style={{ background: 'var(--color-soc-card)' }}>
              {s === 'All' ? 'All Statuses' : s}
            </option>
          ))}
        </select>

        {(search || priorityFilter !== 'All' || statusFilter !== 'All') && (
          <button onClick={() => { setSearch(''); setPriority('All'); setStatus('All') }}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-soc-amber)] border border-[rgba(255,176,32,0.3)] hover:bg-[var(--color-soc-amber-glow)] transition-colors whitespace-nowrap">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Ticket Table ── */}
      <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-soc-text)]">All IT Tickets</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} ticket${filtered.length !== 1 ? 's' : ''}${filtered.length !== tickets.length ? ` (filtered from ${tickets.length})` : ''}`}
            </p>
          </div>
          {!loading && tickets.length > 0 && (
            <span className="text-[9px] text-[var(--color-soc-green)] border border-[var(--color-soc-green)] rounded px-1.5 py-0.5 font-bold tracking-wider">
              LIVE DATA
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-soc-border-subtle)]">
                {['ID', 'Title', 'Category', 'Priority', 'Status', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : filtered.length > 0
                  ? filtered.map((t) => (
                      <tr key={t.id}
                        onClick={() => setSelected(t)}
                        className="border-b border-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer group">
                        <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] whitespace-nowrap group-hover:underline">
                          {fmtId(t.id)}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text)] font-medium max-w-[220px]">
                          <span className="block truncate">{t.title}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap">
                          {t.category || <span className="italic text-[var(--color-soc-text-dim)]">Analysing…</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PriorityBadge level={t.priority} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap font-mono text-[10px]">
                          {fmtDate(t.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-[10px] text-[var(--color-soc-accent)] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                            View →
                          </span>
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[var(--color-soc-border-subtle)] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-dim)" strokeWidth={1.5} className="w-6 h-6">
                              <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-soc-text-muted)]">
                              {tickets.length === 0 ? 'No tickets yet' : 'No matching tickets'}
                            </p>
                            <p className="text-xs text-[var(--color-soc-text-dim)] mt-1">
                              {tickets.length === 0
                                ? 'Create the first ticket using the button above'
                                : 'Try adjusting your search or filters'}
                            </p>
                          </div>
                          {tickets.length > 0 && (
                            <button onClick={() => { setSearch(''); setPriority('All'); setStatus('All') }}
                              className="text-xs text-[var(--color-soc-accent)] hover:underline font-medium">
                              Clear all filters
                            </button>
                          )}
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
            <span>Click any row to view diagnosis, fix steps &amp; ticket history</span>
            <span>{filtered.length} of {tickets.length} shown</span>
          </div>
        )}
      </div>

      {/* ── Modals / Drawer ── */}
      {showCreate && (
        <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {selected && (
        <TicketDrawer
          ticket={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}

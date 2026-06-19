/**
 * IncidentPage.jsx
 *
 * Incident management page for the Admin / SOC portal.
 *
 * Features:
 *  - GET /incidents   → table with search + severity + status filters
 *  - POST /incidents  → create modal (title + description)
 *  - Incident detail drawer (slide-in from right)
 *  - SkeletonRow loading states
 *  - ErrorBanner on API failure
 *  - Severity + Status badges
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getIncidents, createIncident } from '../api/incidentService'
import { SkeletonRow } from '../components/Skeletons'
import ErrorBanner from '../components/ErrorBanner'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_LEVELS = ['All', 'Critical', 'High', 'Medium', 'Low', 'Pending']
const STATUS_OPTIONS  = ['All', 'Open', 'In Progress', 'Resolved', 'Closed']

const SEVERITY_STYLES = {
  Critical: 'status-critical',
  High:     'status-warning',
  Medium:   'status-info',
  Low:      'status-active',
  Pending:  'bg-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)]',
}

const STATUS_STYLES = {
  'Open':        'status-critical',
  'In Progress': 'status-warning',
  'Resolved':    'status-active',
  'Closed':      'status-info',
}

const SEVERITY_DOT = {
  Critical: 'var(--color-soc-red)',
  High:     'var(--color-soc-amber)',
  Medium:   'var(--color-soc-accent)',
  Low:      'var(--color-soc-green)',
  Pending:  'var(--color-soc-text-muted)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatId(id) {
  return `INC-${String(id).padStart(5, '0')}`
}

function confidenceBar(score) {
  if (score == null) return null
  const pct = Math.min(Math.max(score, 0), 100)
  const color = pct >= 80 ? 'var(--color-soc-green)' : pct >= 50 ? 'var(--color-soc-amber)' : 'var(--color-soc-red)'
  return { pct, color }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small display components
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ level }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLES[level] || SEVERITY_STYLES.Pending}`}>
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: SEVERITY_DOT[level] || 'currentColor' }} />
      {level || 'Pending'}
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

function ConfidenceBar({ score }) {
  const bar = confidenceBar(score)
  if (!bar) return <span className="text-[var(--color-soc-text-muted)]">—</span>
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, background: bar.color, boxShadow: `0 0 6px ${bar.color}` }} />
      </div>
      <span className="text-[10px] tabular-nums font-bold" style={{ color: bar.color }}>{bar.pct.toFixed(0)}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

function IncidentDrawer({ incident, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!incident) return null

  const bar = confidenceBar(incident.confidence_score)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 fade-in"
        onClick={onClose}
      />

      {/* Drawer panel — slides in from right */}
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col
                   bg-[var(--color-soc-surface)] border-l border-[var(--color-soc-border-subtle)]
                   shadow-2xl slide-in-drawer"
        style={{ animation: 'slideInRight 0.28s ease-out forwards' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-[var(--color-soc-accent)]">{formatId(incident.id)}</span>
              <SeverityBadge level={incident.severity} />
            </div>
            <h2 className="text-base font-bold text-[var(--color-soc-text)] leading-snug">{incident.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-card)] transition-colors flex-shrink-0"
            aria-label="Close drawer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Status row */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <div>
              <p className="text-[10px] text-[var(--color-soc-text-muted)] uppercase tracking-widest mb-1">Current Status</p>
              <StatusBadge status={incident.status} />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[var(--color-soc-text-muted)] uppercase tracking-widest mb-1">Created</p>
              <p className="text-xs text-[var(--color-soc-text)] font-mono">{formatDate(incident.created_at)}</p>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Category',  value: incident.category  || 'Pending AI Analysis' },
              { label: 'Severity',  value: <SeverityBadge level={incident.severity} /> },
              { label: 'Status',    value: <StatusBadge status={incident.status} /> },
              { label: 'Incident ID', value: <span className="font-mono text-[var(--color-soc-accent)] text-xs">{formatId(incident.id)}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1.5">{label}</p>
                <div className="text-xs text-[var(--color-soc-text)] font-medium">{value}</div>
              </div>
            ))}
          </div>

          {/* Confidence score */}
          <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold">AI Confidence Score</p>
              {bar && (
                <span className="text-xs font-black tabular-nums" style={{ color: bar.color }}>{bar.pct.toFixed(1)}%</span>
              )}
            </div>
            {bar ? (
              <div className="h-2 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${bar.pct}%`, background: bar.color, boxShadow: `0 0 8px ${bar.color}` }} />
              </div>
            ) : (
              <p className="text-xs text-[var(--color-soc-text-muted)] italic">Score pending AI analysis</p>
            )}
            <p className="text-[10px] text-[var(--color-soc-text-dim)] mt-2">
              AI classification confidence based on incident description analysis
            </p>
          </div>

          {/* Description */}
          <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-3">Description</p>
            <p className="text-sm text-[var(--color-soc-text)] leading-relaxed whitespace-pre-wrap">
              {incident.description || 'No description provided.'}
            </p>
          </div>

          {/* AI Classification note */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.15)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[11px] text-[var(--color-soc-accent)] leading-relaxed">
              Category and severity were automatically assigned by the AI classification engine upon incident creation.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Incident Modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateIncidentModal({ onClose, onCreated }) {
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const titleRef = useRef(null)

  // Focus title on mount
  useEffect(() => { titleRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, submitting])

  function validate() {
    const errors = {}
    if (!title.trim())       errors.title = 'Title is required'
    if (!description.trim()) errors.description = 'Description is required'
    else if (description.trim().length < 20) errors.description = 'Provide at least 20 characters for AI analysis'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await createIncident({ title: title.trim(), description: description.trim() })
      onCreated(result)
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Failed to create incident. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = [
    'w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-soc-surface)]',
    'text-[var(--color-soc-text)] border outline-none transition-all',
    'placeholder:text-[var(--color-soc-text-dim)]',
  ].join(' ')

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 fade-in"
        onClick={() => !submitting && onClose()}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] shadow-2xl fade-in overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={1.8} className="w-5 h-5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-soc-text)]">Report New Incident</h2>
                <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">AI will classify severity and category automatically</p>
              </div>
            </div>
            <button onClick={() => !submitting && onClose()}
              className="p-2 rounded-lg text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)] transition-colors disabled:opacity-40"
              disabled={submitting} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">

            {/* API error */}
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
              <label htmlFor="inc-title" className="block text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">
                Incident Title <span className="text-[var(--color-soc-red)]">*</span>
              </label>
              <input
                id="inc-title"
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFieldErrors((p) => ({ ...p, title: '' })) }}
                placeholder="e.g. Brute force attack on SSH port 22"
                className={`${inputBase} ${fieldErrors.title ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
                disabled={submitting}
              />
              {fieldErrors.title && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{fieldErrors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="inc-desc" className="text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">
                  Description <span className="text-[var(--color-soc-red)]">*</span>
                </label>
                <span className={`text-[10px] tabular-nums ${description.length < 20 ? 'text-[var(--color-soc-text-dim)]' : 'text-[var(--color-soc-green)]'}`}>
                  {description.length} chars
                </span>
              </div>
              <textarea
                id="inc-desc"
                rows={5}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setFieldErrors((p) => ({ ...p, description: '' })) }}
                placeholder="Describe the incident in detail — what happened, which systems are affected, any indicators of compromise, timeline of events... The AI uses this to classify severity and category."
                className={`${inputBase} resize-none ${fieldErrors.description ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
                disabled={submitting}
              />
              {fieldErrors.description && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{fieldErrors.description}</p>}
            </div>

            {/* AI note */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.15)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="10"/>
              </svg>
              <p className="text-[10px] text-[var(--color-soc-accent)] leading-relaxed">
                The AI engine will automatically assign <strong>category</strong>, <strong>severity</strong>, and a <strong>confidence score</strong> based on your description.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] hover:border-[var(--color-soc-border)] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-soc-red)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 20px var(--color-soc-red-glow)' }}
              >
                {submitting ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Submitting to AI...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Create Incident
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
// Main IncidentPage
// ─────────────────────────────────────────────────────────────────────────────

export default function IncidentPage() {
  const [incidents, setIncidents]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [errorDismissed, setErrorDismissed] = useState(false)

  // Filters
  const [search, setSearch]             = useState('')
  const [severityFilter, setSeverityFilter] = useState('All')
  const [statusFilter, setStatusFilter]     = useState('All')

  // Modals
  const [showCreate, setShowCreate]     = useState(false)
  const [selectedIncident, setSelectedIncident] = useState(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDismissed(false)
    try {
      const data = await getIncidents()
      // Sort newest first
      setIncidents(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (err) {
      setError(err.message || 'Failed to load incidents from backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  // ── Filtered / searched rows ───────────────────────────────────────────────
  const filtered = incidents.filter((inc) => {
    const matchSearch   = !search || inc.title?.toLowerCase().includes(search.toLowerCase())
    const matchSeverity = severityFilter === 'All' || inc.severity === severityFilter
    const matchStatus   = statusFilter   === 'All' || inc.status   === statusFilter
    return matchSearch && matchSeverity && matchStatus
  })

  // ── Severity counts for filter pills ──────────────────────────────────────
  const severityCounts = incidents.reduce((acc, inc) => {
    acc[inc.severity] = (acc[inc.severity] || 0) + 1
    return acc
  }, {})

  // ── Called after successful POST ──────────────────────────────────────────
  function handleCreated() {
    fetchIncidents()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">
            Incident Management
          </h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
            AI-classified security incidents · Real-time threat tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live count pill */}
          {!loading && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-red)] animate-pulse" />
              <span className="text-xs font-mono text-[var(--color-soc-text-muted)]">
                <span className="text-[var(--color-soc-red)] font-bold">
                  {incidents.filter((i) => i.status === 'Open').length}
                </span>{' '}open
                {' · '}
                <span className="text-[var(--color-soc-text)] font-bold">{incidents.length}</span> total
              </span>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={fetchIncidents}
            disabled={loading}
            title="Refresh incidents"
            className="p-2 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] hover:border-[var(--color-soc-accent)] transition-all disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>

          {/* Create button */}
          <button
            id="create-incident-btn"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-soc-red)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 16px var(--color-soc-red-glow)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Incident
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && !errorDismissed && (
        <ErrorBanner
          message={error}
          onRetry={() => { setErrorDismissed(false); fetchIncidents() }}
          onDismiss={() => setErrorDismissed(true)}
        />
      )}

      {/* ── Severity summary cards ── */}
      {!loading && incidents.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { level: 'Critical', color: 'var(--color-soc-red)',    glow: 'var(--color-soc-red-glow)' },
            { level: 'High',     color: 'var(--color-soc-amber)',  glow: 'var(--color-soc-amber-glow)' },
            { level: 'Medium',   color: 'var(--color-soc-accent)', glow: 'var(--color-soc-accent-glow)' },
            { level: 'Low',      color: 'var(--color-soc-green)',  glow: 'var(--color-soc-green-glow)' },
          ].map(({ level, color, glow }) => (
            <button
              key={level}
              onClick={() => setSeverityFilter(severityFilter === level ? 'All' : level)}
              className={[
                'flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                severityFilter === level
                  ? 'border-current bg-[var(--color-soc-card)]'
                  : 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] hover:border-current',
              ].join(' ')}
              style={{ color, '--tw-shadow': glow }}
            >
              <span className="text-2xl font-black tabular-nums" style={{ color }}>{severityCounts[level] || 0}</span>
              <div>
                <p className="text-xs font-bold" style={{ color }}>{level}</p>
                <p className="text-[10px] text-[var(--color-soc-text-dim)]">incidents</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Search & filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-soc-text-dim)]">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="incident-search"
            type="search"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] placeholder:text-[var(--color-soc-text-dim)] outline-none focus:border-[var(--color-soc-accent)] transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-text)] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Severity filter */}
        <select
          id="severity-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer"
        >
          {SEVERITY_LEVELS.map((s) => (
            <option key={s} value={s} style={{ background: 'var(--color-soc-card)' }}>
              {s === 'All' ? 'All Severities' : s}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} style={{ background: 'var(--color-soc-card)' }}>
              {s === 'All' ? 'All Statuses' : s}
            </option>
          ))}
        </select>

        {/* Active filter count / clear */}
        {(search || severityFilter !== 'All' || statusFilter !== 'All') && (
          <button
            onClick={() => { setSearch(''); setSeverityFilter('All'); setStatusFilter('All') }}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-soc-amber)] border border-[rgba(255,176,32,0.3)] hover:bg-[var(--color-soc-amber-glow)] transition-colors whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Incident Table ── */}
      <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-soc-text)]">All Incidents</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
              {loading ? 'Loading...' : `${filtered.length} incident${filtered.length !== 1 ? 's' : ''} ${filtered.length !== incidents.length ? `(filtered from ${incidents.length})` : ''}`}
            </p>
          </div>
          {!loading && incidents.length > 0 && (
            <span className="text-[9px] text-[var(--color-soc-green)] border border-[var(--color-soc-green)] rounded px-1.5 py-0.5 font-bold tracking-wider">
              LIVE DATA
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-soc-border-subtle)]">
                {['ID', 'Title', 'Category', 'Severity', 'Confidence', 'Status', 'Created'].map((h) => (
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
                  ? filtered.map((inc) => (
                      <tr
                        key={inc.id}
                        onClick={() => setSelectedIncident(inc)}
                        className="border-b border-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] whitespace-nowrap group-hover:underline">
                          {formatId(inc.id)}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text)] font-medium max-w-[220px]">
                          <span className="block truncate">{inc.title}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap">
                          {inc.category || <span className="italic text-[var(--color-soc-text-dim)]">Analysing…</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <SeverityBadge level={inc.severity} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ConfidenceBar score={inc.confidence_score} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={inc.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap font-mono text-[10px]">
                          {formatDate(inc.created_at)}
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[var(--color-soc-border-subtle)] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-dim)" strokeWidth={1.5} className="w-6 h-6">
                              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-soc-text-muted)]">
                              {incidents.length === 0 ? 'No incidents yet' : 'No matching incidents'}
                            </p>
                            <p className="text-xs text-[var(--color-soc-text-dim)] mt-1">
                              {incidents.length === 0
                                ? 'Create the first incident using the button above'
                                : 'Try adjusting your search or filters'}
                            </p>
                          </div>
                          {incidents.length > 0 && (
                            <button onClick={() => { setSearch(''); setSeverityFilter('All'); setStatusFilter('All') }}
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

        {/* Table footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--color-soc-border-subtle)] flex items-center justify-between text-[10px] text-[var(--color-soc-text-muted)]">
            <span>Click any row to view incident details</span>
            <span>{filtered.length} of {incidents.length} shown</span>
          </div>
        )}
      </div>

      {/* ── Modals / Drawer ── */}
      {showCreate && (
        <CreateIncidentModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  )
}

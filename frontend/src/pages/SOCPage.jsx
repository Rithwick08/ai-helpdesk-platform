/**
 * SOCPage.jsx
 *
 * SOC Automation Centre — alerts, threat analysis, and automated response actions.
 *
 * Key backend behaviour:
 *  - POST /alerts with High/Critical severity → auto-creates Incident + 3 Actions
 *  - GET  /alerts → alert table with threat-type filtering
 *  - GET  /actions → all automated actions table
 *  - GET  /actions/{incident_id} → actions scoped to a specific incident
 *
 * Layout:
 *  ┌─ Alert table (search + threat type + severity filters) ─────────────────┐
 *  │  Click row → Alert Detail Drawer (right slide-in)                       │
 *  │    Drawer shows: meta + alert_data + recommended action                 │
 *  │    For High/Critical: Auto-Action Pipeline (actions for that incident)  │
 *  └──────────────────────────────────────────────────────────────────────────┘
 *  ┌─ Automated Actions log (full table of all actions) ─────────────────────┐
 *  └──────────────────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getAlerts,
  createAlert,
  getActions,
  getActionsByIncident,
} from '../api/alertService'
import { SkeletonRow } from '../components/Skeletons'
import ErrorBanner from '../components/ErrorBanner'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_LEVELS  = ['All', 'Critical', 'High', 'Medium', 'Low']
const ACTION_STATUS_STYLES = {
  Completed:  'status-active',
  Running:    'status-warning',
  Failed:     'status-critical',
  Pending:    'status-info',
}

const SEVERITY_STYLES = {
  Critical: 'status-critical',
  High:     'status-warning',
  Medium:   'status-info',
  Low:      'status-active',
}

const SEVERITY_DOT = {
  Critical: 'var(--color-soc-red)',
  High:     'var(--color-soc-amber)',
  Medium:   'var(--color-soc-accent)',
  Low:      'var(--color-soc-green)',
}

const SEVERITY_GLOW = {
  Critical: { bg: 'var(--color-soc-red-glow)',   border: 'rgba(255,59,92,0.25)',   text: 'var(--color-soc-red)' },
  High:     { bg: 'var(--color-soc-amber-glow)', border: 'rgba(255,176,32,0.25)',  text: 'var(--color-soc-amber)' },
  Medium:   { bg: 'var(--color-soc-accent-glow)',border: 'rgba(0,212,255,0.15)',   text: 'var(--color-soc-accent)' },
  Low:      { bg: 'var(--color-soc-green-glow)', border: 'rgba(0,255,136,0.15)',   text: 'var(--color-soc-green)' },
}

const PIPELINE_STEPS = [
  { name: 'Create Incident', icon: 'incident' },
  { name: 'Notify SOC Team', icon: 'notify' },
  { name: 'Generate Report', icon: 'report' },
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

function fmtId(id, prefix = 'ALT') {
  return `${prefix}-${String(id).padStart(5, '0')}`
}

// Derive unique threat types from alerts list for filter dropdown
function getThreatTypes(alerts) {
  const types = [...new Set(alerts.map((a) => a.threat_type).filter(Boolean))]
  return ['All', ...types.sort()]
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ level }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLES[level] || 'status-info'}`}>
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: SEVERITY_DOT[level] || 'currentColor' }} />
      {level || '—'}
    </span>
  )
}

function ActionStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ACTION_STATUS_STYLES[status] || 'status-info'}`}>
      {status === 'Completed' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Action Pipeline (for High/Critical alerts in the drawer)
// ─────────────────────────────────────────────────────────────────────────────

function PipelineIcons({ name }) {
  if (name === 'Create Incident') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
  if (name === 'Notify SOC Team') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path d="M22 17H2a3 3 0 000 6h20a3 3 0 000-6zM17 11V7A5 5 0 007 7v4"/>
      <circle cx="12" cy="23" r="1"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

function AutoPipeline({ actions }) {
  if (!actions || actions.length === 0) return null
  // Map actions by name for quick lookup
  const actionMap = {}
  actions.forEach((a) => { actionMap[a.action_name] = a })

  return (
    <div className="p-4 rounded-xl border border-[rgba(0,212,255,0.2)] bg-[var(--color-soc-accent-glow)]">
      <div className="flex items-center gap-2 mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-accent)] font-bold">
          Automated Response Pipeline
        </p>
        <span className="ml-auto text-[9px] font-bold text-[var(--color-soc-green)] border border-[rgba(0,255,136,0.3)] rounded px-1.5 py-0.5">
          {actions.filter((a) => a.action_status === 'Completed').length}/{actions.length} done
        </span>
      </div>

      <div className="space-y-3">
        {PIPELINE_STEPS.map((step, i) => {
          const action = actionMap[step.name]
          const isDone = action?.action_status === 'Completed'
          return (
            <div key={step.name} className="relative">
              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={`absolute left-4 top-8 bottom-0 w-0.5 ${isDone ? 'bg-[var(--color-soc-green)]' : 'bg-[var(--color-soc-border-subtle)]'}`} />
              )}
              <div className="flex items-start gap-3">
                {/* Step circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 z-10 ${
                  isDone
                    ? 'bg-[var(--color-soc-green)] border-[var(--color-soc-green)] text-[var(--color-soc-bg)]'
                    : 'bg-[var(--color-soc-surface)] border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-dim)]'
                }`}>
                  {isDone
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <PipelineIcons name={step.name} />
                  }
                </div>
                {/* Content */}
                <div className="flex-1 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold ${isDone ? 'text-[var(--color-soc-text)]' : 'text-[var(--color-soc-text-dim)]'}`}>
                      {step.name}
                    </p>
                    {action && <ActionStatusBadge status={action.action_status} />}
                  </div>
                  {action?.action_output && (
                    <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5 leading-relaxed">
                      {action.action_output}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

function AlertDrawer({ alert, onClose }) {
  const [actions, setActions]         = useState([])
  const [actLoading, setActLoading]   = useState(false)
  const isHighSeverity = ['Critical', 'High'].includes(alert.severity)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // For High/Critical alerts, try to load associated actions via incident_id
  useEffect(() => {
    if (!isHighSeverity) return
    // We don't directly know incident_id from alert; fetch all actions and filter by alert_id
    setActLoading(true)
    getActions()
      .then((all) => {
        const related = all.filter((a) => a.alert_id === alert.id)
        setActions(related)
      })
      .catch(() => setActions([]))
      .finally(() => setActLoading(false))
  }, [alert.id, isHighSeverity])

  const sev = SEVERITY_GLOW[alert.severity] || SEVERITY_GLOW.Medium

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
              <span className="font-mono text-xs text-[var(--color-soc-accent)]">{fmtId(alert.id)}</span>
              <SeverityBadge level={alert.severity} />
              {isHighSeverity && (
                <span className="text-[9px] font-bold text-[var(--color-soc-red)] border border-[rgba(255,59,92,0.4)] px-1.5 py-0.5 rounded animate-pulse">
                  AUTO-RESPONDED
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[var(--color-soc-text)] leading-snug">{alert.alert_name}</h2>
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

          {/* Severity highlight card */}
          <div className="p-4 rounded-xl border" style={{ background: sev.bg, borderColor: sev.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
                style={{ background: sev.bg, borderColor: sev.border }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={sev.text} strokeWidth={2} className="w-5 h-5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: sev.text }}>
                  Threat Classification
                </p>
                <p className="text-sm font-bold text-[var(--color-soc-text)] mt-0.5">{alert.threat_type || '—'}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: sev.text }}>Severity</p>
                <SeverityBadge level={alert.severity} />
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Alert ID',    value: <span className="font-mono text-[var(--color-soc-accent)] text-xs">{fmtId(alert.id)}</span> },
              { label: 'Created',     value: <span className="font-mono text-[10px]">{fmtDate(alert.created_at)}</span> },
              { label: 'Threat Type', value: <span className="text-xs">{alert.threat_type || '—'}</span> },
              { label: 'Auto-Action', value: (
                <span className={`text-xs font-bold ${isHighSeverity ? 'text-[var(--color-soc-red)]' : 'text-[var(--color-soc-text-muted)]'}`}>
                  {isHighSeverity ? '✓ Triggered' : 'Not required'}
                </span>
              )},
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1.5">{label}</p>
                <div className="text-xs text-[var(--color-soc-text)] font-medium">{value}</div>
              </div>
            ))}
          </div>

          {/* Alert Data */}
          <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-2">Alert Data</p>
            <p className="text-sm text-[var(--color-soc-text)] leading-relaxed whitespace-pre-wrap font-mono text-[11px] bg-[var(--color-soc-surface)] rounded-lg p-3">
              {alert.alert_data || 'No alert data available.'}
            </p>
          </div>

          {/* Recommended Action */}
          {alert.recommended_action && (
            <div className="p-4 rounded-xl bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2} className="w-4 h-4">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-green)] font-bold">Recommended Action</p>
              </div>
              <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">{alert.recommended_action}</p>
            </div>
          )}

          {/* Auto-Response Pipeline */}
          {isHighSeverity && (
            <>
              {actLoading ? (
                <div className="p-4 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <div className="shimmer w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="shimmer h-2.5 rounded w-1/2" />
                          <div className="shimmer h-2 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <AutoPipeline actions={actions} />
              )}
            </>
          )}

          {/* Low/Medium note */}
          {!isHighSeverity && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-muted)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-[var(--color-soc-text-muted)] leading-relaxed">
                Automated response pipeline is only triggered for <strong>High</strong> and <strong>Critical</strong> severity alerts.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Alert Modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateAlertModal({ onClose, onCreated }) {
  const [alertName, setAlertName] = useState('')
  const [alertData, setAlertData] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, submitting])

  function validate() {
    const e = {}
    if (!alertName.trim()) e.alertName = 'Alert name is required'
    if (!alertData.trim()) e.alertData = 'Alert data is required'
    else if (alertData.trim().length < 20) e.alertData = 'Provide at least 20 characters for AI analysis'
    setFieldErrors(e)
    return !Object.keys(e).length
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await createAlert({ alert_name: alertName.trim(), alert_data: alertData.trim() })
      setResult(res)
      onCreated()
    } catch (err) {
      setError(err.message || 'Failed to create alert.')
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
              <div className="w-9 h-9 rounded-xl bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={1.8} className="w-5 h-5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-soc-text)]">
                  {result ? 'Alert Created' : 'Create Security Alert'}
                </h2>
                <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
                  {result
                    ? result.severity === 'Critical' || result.severity === 'High'
                      ? '⚡ High severity — automated response triggered'
                      : 'AI analysed and classified the alert'
                    : 'AI will classify threat type, severity & recommend action'}
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

          {/* Success state */}
          {result ? (
            <div className="px-6 py-6 space-y-4">
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${
                ['Critical', 'High'].includes(result.severity)
                  ? 'bg-[var(--color-soc-red-glow)] border-[rgba(255,59,92,0.25)]'
                  : 'bg-[var(--color-soc-green-glow)] border-[rgba(0,255,136,0.2)]'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ['Critical', 'High'].includes(result.severity)
                    ? 'bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.3)]'
                    : 'bg-[var(--color-soc-green-glow)] border border-[rgba(0,255,136,0.3)]'
                }`}>
                  {['Critical', 'High'].includes(result.severity)
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-5 h-5">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-green)" strokeWidth={2.5} className="w-5 h-5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                  }
                </div>
                <div>
                  <p className={`text-sm font-bold ${['Critical', 'High'].includes(result.severity) ? 'text-[var(--color-soc-red)]' : 'text-[var(--color-soc-green)]'}`}>
                    {['Critical', 'High'].includes(result.severity)
                      ? 'Critical/High Alert — Automated Response Triggered!'
                      : 'Alert Logged Successfully'}
                  </p>
                  <p className="text-xs text-[var(--color-soc-text-muted)] mt-1">
                    Severity: <strong>{result.severity}</strong> · ID: {fmtId(result.id)}
                  </p>
                  {['Critical', 'High'].includes(result.severity) && (
                    <p className="text-xs text-[var(--color-soc-amber)] mt-1">
                      Incident auto-created · SOC notified · Threat report generated
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text)] hover:border-[var(--color-soc-accent)] transition-colors">
                Close
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.25)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-4 h-4 flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs text-[var(--color-soc-red)]">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="alert-name" className="block text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">
                  Alert Name <span className="text-[var(--color-soc-red)]">*</span>
                </label>
                <input id="alert-name" ref={nameRef} type="text" value={alertName}
                  onChange={(e) => { setAlertName(e.target.value); setFieldErrors((p) => ({ ...p, alertName: '' })) }}
                  placeholder="e.g. Suspicious outbound traffic on port 443"
                  disabled={submitting}
                  className={`${inputBase} ${fieldErrors.alertName ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
                />
                {fieldErrors.alertName && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{fieldErrors.alertName}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="alert-data" className="text-xs font-semibold text-[var(--color-soc-text-muted)] uppercase tracking-wider">
                    Alert Data / Description <span className="text-[var(--color-soc-red)]">*</span>
                  </label>
                  <span className={`text-[10px] tabular-nums ${alertData.length < 20 ? 'text-[var(--color-soc-text-dim)]' : 'text-[var(--color-soc-green)]'}`}>
                    {alertData.length} chars
                  </span>
                </div>
                <textarea id="alert-data" rows={5} value={alertData}
                  onChange={(e) => { setAlertData(e.target.value); setFieldErrors((p) => ({ ...p, alertData: '' })) }}
                  placeholder="Describe the alert in detail — source IP, destination, protocol, payload indicators, SIEM rule triggered, timestamps, affected hosts... AI uses this to classify threat type and severity."
                  disabled={submitting}
                  className={`${inputBase} resize-none font-mono text-[11px] ${fieldErrors.alertData ? 'border-[var(--color-soc-red)]' : 'border-[var(--color-soc-border-subtle)] focus:border-[var(--color-soc-accent)]'}`}
                />
                {fieldErrors.alertData && <p className="mt-1.5 text-[11px] text-[var(--color-soc-red)]">{fieldErrors.alertData}</p>}
              </div>

              {/* Auto-response note */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.15)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <p className="text-[10px] text-[var(--color-soc-red)] leading-relaxed">
                  If AI classifies as <strong>High</strong> or <strong>Critical</strong>, the system will automatically create an incident, notify the SOC team, and generate a threat report.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-soc-border-subtle)] text-sm font-semibold text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-border)] transition-colors disabled:opacity-40">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-soc-red)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ boxShadow: '0 0 20px var(--color-soc-red-glow)' }}>
                  {submitting
                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Analysing…</>
                    : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Create Alert</>
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SOCPage
// ─────────────────────────────────────────────────────────────────────────────

export default function SOCPage() {
  const [alerts, setAlerts]             = useState([])
  const [actions, setActions]           = useState([])
  const [alertLoading, setAlertLoading] = useState(true)
  const [actionLoading, setActLoading]  = useState(true)
  const [alertError, setAlertError]     = useState(null)
  const [alertErrDismissed, setAlertErrD] = useState(false)

  const [search, setSearch]             = useState('')
  const [severityFilter, setSeverity]   = useState('All')
  const [threatFilter, setThreat]       = useState('All')

  const [showCreate, setShowCreate]     = useState(false)
  const [selected, setSelected]         = useState(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setAlertLoading(true)
    setActLoading(true)
    setAlertError(null)
    setAlertErrD(false)

    Promise.all([getAlerts(), getActions()]).then(([alertData, actionData]) => {
      setAlerts(alertData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      setActions(actionData.sort((a, b) => b.id - a.id))
    }).catch((err) => {
      setAlertError(err.message || 'Failed to load SOC data.')
    }).finally(() => {
      setAlertLoading(false)
      setActLoading(false)
    })
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Dynamic threat type list
  const threatTypes = getThreatTypes(alerts)

  // ── Filtered alerts ─────────────────────────────────────────────────────────
  const filteredAlerts = alerts.filter((a) => {
    const matchSearch   = !search || a.alert_name?.toLowerCase().includes(search.toLowerCase())
    const matchSeverity = severityFilter === 'All' || a.severity === severityFilter
    const matchThreat   = threatFilter   === 'All' || a.threat_type === threatFilter
    return matchSearch && matchSeverity && matchThreat
  })

  // Stats
  const criticalCount = alerts.filter((a) => a.severity === 'Critical').length
  const autoActioned  = alerts.filter((a) => ['Critical', 'High'].includes(a.severity)).length

  function handleCreated() { fetchAll() }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">SOC Automation</h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
            AI threat analysis · Automated incident response · Real-time action pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live stats */}
          {!alertLoading && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-red)] animate-pulse" />
              <span className="text-xs font-mono text-[var(--color-soc-text-muted)]">
                <span className="text-[var(--color-soc-red)] font-bold">{criticalCount}</span>{' '}critical
                {' · '}
                <span className="text-[var(--color-soc-amber)] font-bold">{autoActioned}</span>{' '}auto-responded
                {' · '}
                <span className="text-[var(--color-soc-text)] font-bold">{alerts.length}</span>{' '}total
              </span>
            </div>
          )}

          {/* Refresh */}
          <button onClick={fetchAll} disabled={alertLoading} title="Refresh all SOC data"
            className="p-2 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)] hover:border-[var(--color-soc-accent)] transition-all disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${alertLoading ? 'animate-spin' : ''}`}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>

          {/* Create */}
          <button id="create-alert-btn" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-soc-red)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 16px var(--color-soc-red-glow)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            New Alert
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {alertError && !alertErrDismissed && (
        <ErrorBanner message={alertError} onRetry={() => { setAlertErrD(false); fetchAll() }} onDismiss={() => setAlertErrD(true)} />
      )}

      {/* ── Severity summary cards ── */}
      {!alertLoading && alerts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { level: 'Critical', color: 'var(--color-soc-red)',    label: 'Critical Alerts' },
            { level: 'High',     color: 'var(--color-soc-amber)',  label: 'High Alerts' },
            { level: 'Medium',   color: 'var(--color-soc-accent)', label: 'Medium Alerts' },
            { level: 'Low',      color: 'var(--color-soc-green)',  label: 'Low Alerts' },
          ].map(({ level, color, label }) => {
            const count = alerts.filter((a) => a.severity === level).length
            return (
              <button key={level}
                onClick={() => setSeverity(severityFilter === level ? 'All' : level)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  severityFilter === level
                    ? 'border-current bg-[var(--color-soc-card)]'
                    : 'border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] hover:border-current'
                }`}
                style={{ color }}>
                <span className="text-2xl font-black tabular-nums" style={{ color }}>{count}</span>
                <div>
                  <p className="text-xs font-bold" style={{ color }}>{level}</p>
                  <p className="text-[10px] text-[var(--color-soc-text-dim)]">alerts</p>
                </div>
                {(level === 'Critical' || level === 'High') && count > 0 && (
                  <span className="ml-auto text-[8px] font-bold border rounded px-1 py-0.5" style={{ color, borderColor: color, opacity: 0.7 }}>
                    AUTO
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-soc-text-dim)]">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="alert-search" type="search" placeholder="Search by alert name..."
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

        {/* Threat type filter — dynamic from data */}
        <select id="threat-filter" value={threatFilter} onChange={(e) => setThreat(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer">
          {threatTypes.map((t) => (
            <option key={t} value={t} style={{ background: 'var(--color-soc-card)' }}>
              {t === 'All' ? 'All Threat Types' : t}
            </option>
          ))}
        </select>

        {/* Severity filter */}
        <select id="severity-filter" value={severityFilter} onChange={(e) => setSeverity(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)] transition-colors cursor-pointer">
          {SEVERITY_LEVELS.map((s) => (
            <option key={s} value={s} style={{ background: 'var(--color-soc-card)' }}>
              {s === 'All' ? 'All Severities' : s}
            </option>
          ))}
        </select>

        {(search || severityFilter !== 'All' || threatFilter !== 'All') && (
          <button onClick={() => { setSearch(''); setSeverity('All'); setThreat('All') }}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-soc-amber)] border border-[rgba(255,176,32,0.3)] hover:bg-[var(--color-soc-amber-glow)] transition-colors whitespace-nowrap">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Alerts Table ── */}
      <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Security Alerts</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
              {alertLoading ? 'Loading…' : `${filteredAlerts.length} alert${filteredAlerts.length !== 1 ? 's' : ''}${filteredAlerts.length !== alerts.length ? ` (filtered from ${alerts.length})` : ''}`}
            </p>
          </div>
          {!alertLoading && alerts.length > 0 && (
            <span className="text-[9px] text-[var(--color-soc-green)] border border-[var(--color-soc-green)] rounded px-1.5 py-0.5 font-bold tracking-wider">LIVE DATA</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-soc-border-subtle)]">
                {['ID', 'Alert Name', 'Threat Type', 'Severity', 'Recommended Action', 'Auto-Response', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : filteredAlerts.length > 0
                  ? filteredAlerts.map((a) => {
                      const isAuto = ['Critical', 'High'].includes(a.severity)
                      return (
                        <tr key={a.id} onClick={() => setSelected(a)}
                          className="border-b border-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer group">
                          <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] whitespace-nowrap group-hover:underline">
                            {fmtId(a.id)}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-soc-text)] font-medium max-w-[200px]">
                            <span className="block truncate">{a.alert_name}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap">
                            {a.threat_type || <span className="italic text-[var(--color-soc-text-dim)]">Analysing…</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <SeverityBadge level={a.severity} />
                          </td>
                          <td className="px-4 py-3 text-[var(--color-soc-text-muted)] max-w-[200px]">
                            <span className="block truncate">{a.recommended_action || '—'}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isAuto
                              ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-soc-red)] border border-[rgba(255,59,92,0.4)] rounded-full px-2 py-0.5">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                  </svg>
                                  Triggered
                                </span>
                              : <span className="text-[10px] text-[var(--color-soc-text-dim)]">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap font-mono text-[10px]">
                            {fmtDate(a.created_at)}
                          </td>
                        </tr>
                      )
                    })
                  : (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[var(--color-soc-border-subtle)] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-dim)" strokeWidth={1.5} className="w-6 h-6">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-[var(--color-soc-text-muted)]">
                            {alerts.length === 0 ? 'No alerts yet' : 'No matching alerts'}
                          </p>
                          <p className="text-xs text-[var(--color-soc-text-dim)]">
                            {alerts.length === 0 ? 'Create the first alert using the button above' : 'Try adjusting your search or filters'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>
        </div>

        {!alertLoading && filteredAlerts.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--color-soc-border-subtle)] flex items-center justify-between text-[10px] text-[var(--color-soc-text-muted)]">
            <span>Click any row to view threat analysis and automated response pipeline</span>
            <span>{filteredAlerts.length} of {alerts.length} shown</span>
          </div>
        )}
      </div>

      {/* ── Automated Actions Table ── */}
      <div className="rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-3.5 h-3.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Automated Response Actions</h2>
              <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
                {actionLoading ? 'Loading…' : `${actions.length} action${actions.length !== 1 ? 's' : ''} executed`}
              </p>
            </div>
          </div>
          {!actionLoading && actions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[var(--color-soc-green)] font-bold border border-[rgba(0,255,136,0.4)] rounded px-1.5 py-0.5">
                {actions.filter((a) => a.action_status === 'Completed').length} completed
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-soc-border-subtle)]">
                {['Action ID', 'Action Name', 'Alert ID', 'Incident ID', 'Status', 'Output'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actionLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                : actions.length > 0
                  ? actions.map((act) => (
                      <tr key={act.id} className="border-b border-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-surface)] transition-colors">
                        <td className="px-4 py-3 font-mono text-[var(--color-soc-text-muted)] text-[10px]">#{act.id}</td>
                        <td className="px-4 py-3 text-[var(--color-soc-text)] font-medium whitespace-nowrap">{act.action_name}</td>
                        <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] text-[10px] whitespace-nowrap">
                          {act.alert_id ? fmtId(act.alert_id) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] text-[10px] whitespace-nowrap">
                          {act.incident_id ? `INC-${String(act.incident_id).padStart(5, '0')}` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ActionStatusBadge status={act.action_status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-soc-text-muted)] max-w-[260px]">
                          <span className="block truncate">{act.action_output || '—'}</span>
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <p className="text-sm text-[var(--color-soc-text-muted)]">No automated actions yet</p>
                        <p className="text-xs text-[var(--color-soc-text-dim)] mt-1">
                          Actions are triggered automatically when High or Critical alerts are created
                        </p>
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals / Drawer ── */}
      {showCreate && (
        <CreateAlertModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {selected && (
        <AlertDrawer alert={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

import { useState } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { SkeletonCard, SkeletonRow, SkeletonList } from '../components/Skeletons'
import ErrorBanner from '../components/ErrorBanner'

// Static dummy data used only when an individual endpoint is unreachable
import {
  recentIncidents as dummyIncidents,
  threatFeed,
  systemHealth,
  aiActivityLog,
} from '../data/dummyData'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeTime(isoString) {
  if (!isoString) return '—'
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ level }) {
  const map = {
    Critical: 'status-critical',
    High:     'status-warning',
    Medium:   'status-info',
    Low:      'status-active',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${map[level] || 'status-info'}`}>
      {level ?? '—'}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    'Open':        'status-critical',
    'In Progress': 'status-warning',
    'Resolved':    'status-active',
    'Pending':     'status-warning',
    'Pending Verification': 'status-warning',
    'Pending Approval':     'status-warning',
    'Completed':   'status-active',
    'Escalated':   'status-critical',
    'Closed':      'status-info',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || 'status-info'}`}>
      {status ?? '—'}
    </span>
  )
}

function StatIcon({ type, color }) {
  const colors = {
    red:    { text: 'text-[var(--color-soc-red)]',    bg: 'bg-[var(--color-soc-red-glow)]' },
    amber:  { text: 'text-[var(--color-soc-amber)]',  bg: 'bg-[var(--color-soc-amber-glow)]' },
    green:  { text: 'text-[var(--color-soc-green)]',  bg: 'bg-[var(--color-soc-green-glow)]' },
    accent: { text: 'text-[var(--color-soc-accent)]', bg: 'bg-[var(--color-soc-accent-glow)]' },
    purple: { text: 'text-[var(--color-soc-purple)]', bg: 'bg-[var(--color-soc-purple-glow)]' },
  }
  const c = colors[color] || colors.accent
  const icons = {
    incident: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    ticket: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/>
      </svg>
    ),
    lock: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
  }
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text}`}>
      {icons[type] || icons.ticket}
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, delta, deltaType, icon, color, isLive }) {
  const deltaColor = deltaType === 'negative'
    ? 'text-[var(--color-soc-red)]'
    : 'text-[var(--color-soc-green)]'

  return (
    <div className="border-glow rounded-xl p-5 bg-[var(--color-soc-card)] flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs text-[var(--color-soc-text-muted)] uppercase tracking-widest">{label}</p>
            {isLive && (
              <span className="text-[8px] font-bold text-[var(--color-soc-green)] border border-[var(--color-soc-green)] rounded px-1 py-px tracking-wider">LIVE</span>
            )}
          </div>
          <p className="text-3xl font-black text-[var(--color-soc-text)] tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <StatIcon type={icon} color={color} />
      </div>
      {delta && (
        <p className={`text-xs font-medium ${deltaColor}`}>{delta}</p>
      )}
    </div>
  )
}

// ── Risk Bar ──────────────────────────────────────────────────────────────────
function RiskBar({ value }) {
  const color = value >= 80 ? 'var(--color-soc-red)' : value >= 60 ? 'var(--color-soc-amber)' : 'var(--color-soc-green)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-soc-border-subtle)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}

function HealthDot({ status }) {
  const map = { Operational: 'var(--color-soc-green)', Degraded: 'var(--color-soc-amber)', Maintenance: 'var(--color-soc-red)' }
  const color = map[status] || 'var(--color-soc-text-muted)'
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
}

function AILogIcon({ type }) {
  const map = {
    block:      { color: 'var(--color-soc-red)',    label: 'B' },
    resolve:    { color: 'var(--color-soc-green)',  label: '✓' },
    quarantine: { color: 'var(--color-soc-amber)',  label: 'Q' },
    flag:       { color: 'var(--color-soc-accent)', label: '!' },
    patch:      { color: 'var(--color-soc-purple)', label: 'P' },
  }
  const { color, label } = map[type] || { color: 'var(--color-soc-text-muted)', label: '?' }
  return (
    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived metric helpers — compute counts from live API arrays
// ─────────────────────────────────────────────────────────────────────────────

function countActive(incidents) {
  if (!incidents) return null
  return incidents.filter((i) => i.status === 'Open' || i.status === 'In Progress').length
}

function countCriticalAlerts(alerts) {
  if (!alerts) return null
  return alerts.filter((a) => a.severity === 'Critical' || a.severity === 'High').length
}

function countOpenTickets(tickets) {
  if (!tickets) return null
  return tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length
}

function countPendingResets(resets) {
  if (!resets) return null
  return resets.filter((r) => r.status !== 'Completed').length
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard component
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { incidents, alerts, itTickets, pwResets, loading, error, backendOnline, refetch } =
    useDashboardData()

  const [bannerDismissed, setBannerDismissed] = useState(false)

  // ── Derived counts (null when that endpoint failed → shows '—') ──
  const activeIncidents  = countActive(incidents)
  const criticalAlerts   = countCriticalAlerts(alerts)
  const openTickets      = countOpenTickets(itTickets)
  const pendingResets    = countPendingResets(pwResets)

  // ── Incidents table: prefer live data, fall back to dummy ──
  const tableData = incidents
    ? incidents.slice(0, 10).map((inc) => ({
        id:       `INC-${String(inc.id).padStart(5, '0')}`,
        title:    inc.title,
        severity: inc.severity,
        status:   inc.status,
        source:   inc.category || '—',
        assignee: 'AI Agent',
        time:     relativeTime(inc.created_at),
      }))
    : dummyIncidents

  // ── Stats card definitions ──
  const statsCards = [
    {
      id: 'active-incidents',
      label: 'Active Incidents',
      value: loading ? '…' : (activeIncidents ?? '—'),
      delta: incidents
        ? `${incidents.filter((i) => i.severity === 'Critical').length} critical`
        : null,
      deltaType: 'negative',
      icon: 'incident',
      color: 'red',
      isLive: !!incidents,
    },
    {
      id: 'critical-alerts',
      label: 'Critical Alerts',
      value: loading ? '…' : (criticalAlerts ?? '—'),
      delta: alerts ? `${alerts.length} total alerts` : null,
      deltaType: 'negative',
      icon: 'shield',
      color: 'amber',
      isLive: !!alerts,
    },
    {
      id: 'open-tickets',
      label: 'Open IT Tickets',
      value: loading ? '…' : (openTickets ?? '—'),
      delta: itTickets
        ? `${itTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length} resolved`
        : null,
      deltaType: 'positive',
      icon: 'ticket',
      color: 'green',
      isLive: !!itTickets,
    },
    {
      id: 'pending-resets',
      label: 'Password Resets',
      value: loading ? '…' : (pendingResets ?? '—'),
      delta: pwResets
        ? `${pwResets.filter((r) => r.status === 'Completed').length} completed`
        : null,
      deltaType: 'positive',
      icon: 'lock',
      color: 'accent',
      isLive: !!pwResets,
    },
  ]

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">
            Security Operations Center
          </h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">
            Real-time threat monitoring · AI-augmented response
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Backend status pill */}
          <div className={[
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold',
            backendOnline
              ? 'bg-[var(--color-soc-green-glow)] border-[var(--color-soc-green)] text-[var(--color-soc-green)]'
              : 'bg-[var(--color-soc-red-glow)] border-[var(--color-soc-red)] text-[var(--color-soc-red)]',
          ].join(' ')}>
            <span className={['w-1.5 h-1.5 rounded-full', backendOnline ? 'bg-[var(--color-soc-green)] animate-pulse' : 'bg-[var(--color-soc-red)]'].join(' ')} />
            {backendOnline ? 'API CONNECTED' : 'API OFFLINE'}
          </div>

          {/* Refresh button */}
          <button
            onClick={refetch}
            disabled={loading}
            title="Refresh data"
            className="p-2 rounded-lg bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]
                       text-[var(--color-soc-text-muted)] hover:text-[var(--color-soc-accent)]
                       hover:border-[var(--color-soc-accent)] transition-all disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={['w-4 h-4', loading ? 'animate-spin' : ''].join(' ')}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && !bannerDismissed && (
        <ErrorBanner
          message={error}
          onRetry={() => { setBannerDismissed(false); refetch() }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* ── Row 1: Metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statsCards.map((s) => <MetricCard key={s.id} {...s} />)}
      </div>

      {/* ── Row 2: Incidents table + AI Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Incidents table — 2 cols */}
        <div className="xl:col-span-2 border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Recent Incidents</h2>
              <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">
                {incidents
                  ? `${incidents.length} total · showing latest 10`
                  : 'Active & in-progress security events'}
              </p>
            </div>
            {incidents && (
              <span className="text-[9px] text-[var(--color-soc-green)] border border-[var(--color-soc-green)] rounded px-1.5 py-0.5 font-bold tracking-wider">
                LIVE DATA
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-soc-border-subtle)]">
                  {['ID', 'Incident', 'Severity', 'Status', 'Category', 'Assignee', 'Time'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : tableData.length > 0
                    ? tableData.map((inc, idx) => (
                        <tr key={inc.id}
                          className="border-b border-[var(--color-soc-border-subtle)] hover:bg-[var(--color-soc-surface)] transition-colors cursor-pointer">
                          <td className="px-4 py-3 font-mono text-[var(--color-soc-accent)] whitespace-nowrap">{inc.id}</td>
                          <td className="px-4 py-3 text-[var(--color-soc-text)] max-w-[200px] truncate font-medium">{inc.title}</td>
                          <td className="px-4 py-3 whitespace-nowrap"><SeverityBadge level={inc.severity} /></td>
                          <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={inc.status} /></td>
                          <td className="px-4 py-3 font-mono text-[var(--color-soc-text-muted)] whitespace-nowrap">{inc.source}</td>
                          <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap">{inc.assignee}</td>
                          <td className="px-4 py-3 text-[var(--color-soc-text-muted)] whitespace-nowrap">{inc.time}</td>
                        </tr>
                      ))
                    : (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-soc-text-muted)] text-xs">
                            No incidents found
                          </td>
                        </tr>
                      )
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Activity Log */}
        <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
            <h2 className="text-sm font-bold text-[var(--color-soc-text)]">AI Agent Activity</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">Automated actions — last 24h</p>
          </div>
          {loading
            ? <SkeletonList rows={5} />
            : (
              <ul className="flex-1 divide-y divide-[var(--color-soc-border-subtle)] overflow-y-auto">
                {aiActivityLog.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-soc-surface)] transition-colors">
                    <AILogIcon type={entry.type} />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--color-soc-text)] leading-snug">{entry.action}</p>
                      <p className="text-[10px] text-[var(--color-soc-text-muted)] mt-1 font-mono">{entry.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
          <div className="px-5 py-3 border-t border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-soc-text-muted)]">Model: GPT-4o (SOC Mode)</span>
              <span className="text-[var(--color-soc-green)] font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Threat Feed + System Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Threat Feed (static demo — no dedicated endpoint yet) */}
        <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-soc-text)]">Live Threat Intelligence</h2>
              <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">Incoming IOCs — last 60 minutes</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-red)] animate-pulse" />
              <span className="text-[10px] text-[var(--color-soc-red)] font-mono font-bold uppercase">Live</span>
            </div>
          </div>
          {loading
            ? <SkeletonList rows={5} />
            : (
              <div className="divide-y divide-[var(--color-soc-border-subtle)]">
                {threatFeed.map((threat) => (
                  <div key={threat.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-soc-surface)] transition-colors">
                    <span className="text-[10px] font-bold font-mono text-[var(--color-soc-text-muted)] w-16 tabular-nums">{threat.timestamp}</span>
                    <span className="flex-1 text-xs font-semibold text-[var(--color-soc-text)]">{threat.type}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)]">{threat.origin}</span>
                    <div className="w-28"><RiskBar value={threat.risk} /></div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* System Health */}
        <div className="border-glow rounded-xl bg-[var(--color-soc-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-soc-border-subtle)]">
            <h2 className="text-sm font-bold text-[var(--color-soc-text)]">System Health</h2>
            <p className="text-[11px] text-[var(--color-soc-text-muted)] mt-0.5">Security infrastructure status</p>
          </div>
          {loading
            ? <SkeletonList rows={6} />
            : (
              <div className="divide-y divide-[var(--color-soc-border-subtle)]">
                {systemHealth.map((sys) => (
                  <div key={sys.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-soc-surface)] transition-colors">
                    <HealthDot status={sys.status} />
                    <span className="flex-1 text-sm font-medium text-[var(--color-soc-text)]">{sys.name}</span>
                    <span className={[
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                      sys.status === 'Operational' ? 'status-active' :
                      sys.status === 'Degraded'    ? 'status-warning' : 'status-critical',
                    ].join(' ')}>
                      {sys.status}
                    </span>
                    <span className="text-xs font-mono text-[var(--color-soc-text-muted)] w-14 text-right">{sys.uptime}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

    </div>
  )
}

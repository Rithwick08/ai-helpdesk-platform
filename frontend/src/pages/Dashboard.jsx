import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  Bell, Users, ShieldAlert, Ticket, KeyRound, PlaySquare, BellRing,
  CheckCircle2, ShieldCheck, Activity, Plus, Upload, Eye, ActivitySquare,
  Database, Server, Cpu, Lock, Loader2, RefreshCw
} from 'lucide-react'
import { getDashboardSummary, getDashboardActivity, getDashboardCharts } from '../api/dashboard'

// ── Static Definitions ────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Create User', icon: Plus },
  { label: 'Publish Security Update', icon: BellRing },
  { label: 'Upload Training Video', icon: Upload },
  { label: 'View Incidents', icon: Eye },
  { label: 'Create IT Ticket', icon: ActivitySquare },
]

const SYSTEM_STATUS = [
  { label: 'AI Assistant', icon: Cpu, status: 'Online' },
  { label: 'Database', icon: Database, status: 'Healthy' },
  { label: 'Authentication', icon: Lock, status: 'Online' },
  { label: 'API Gateway', icon: Server, status: 'Healthy' },
]

// ── Helpers for mapping backend data ──────────────────────────────────────────

const mapSummaryToStats = (summary) => {
  if (!summary) return []
  return [
    { label: 'Total Users', value: summary.total_users, trend: 'All registered', icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
    { label: 'Open Security Incidents', value: summary.open_incidents, trend: 'Active threats', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
    { label: 'Open IT Tickets', value: summary.open_tickets, trend: 'Awaiting resolution', icon: Ticket, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
    { label: 'Password Reset Requests', value: summary.password_requests, trend: 'Total requests', icon: KeyRound, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
    { label: 'Training Videos', value: summary.training_videos, trend: 'Available courses', icon: PlaySquare, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20' },
    { label: 'Security Updates', value: summary.security_updates, trend: 'Published updates', icon: BellRing, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
    { label: 'Resolved Totals', value: summary.resolved_incidents + summary.resolved_tickets, trend: 'Resolved across all', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
    { label: 'Security Health Score', value: '94/100', trend: 'Optimal', icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  ]
}

const mapActivityData = (activities) => {
  return activities.map((item, idx) => {
    let icon = Activity
    let color = 'text-slate-400'
    let bg = 'bg-slate-400/10'

    if (item.type === 'incident') {
      icon = ShieldAlert; color = 'text-red-400'; bg = 'bg-red-400/10'
    } else if (item.type === 'ticket') {
      icon = Ticket; color = 'text-amber-400'; bg = 'bg-amber-400/10'
    } else if (item.type === 'password_reset') {
      icon = KeyRound; color = 'text-purple-400'; bg = 'bg-purple-400/10'
    } else if (item.type === 'security_update') {
      icon = BellRing; color = 'text-cyan-400'; bg = 'bg-cyan-400/10'
    }

    // Format date string to simple time/date representation
    const d = new Date(item.created_at)
    const timeStr = d.toLocaleDateString() === new Date().toLocaleDateString()
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    return {
      id: idx,
      title: item.title,
      description: item.description,
      time: timeStr,
      icon, color, bg
    }
  })
}

const mapBarData = (incident_severity) => {
  const colorMap = {
    'Critical': '#ef4444',
    'High': '#f59e0b',
    'Medium': '#3b82f6',
    'Low': '#10b981'
  }
  return incident_severity.map(item => ({
    name: item.name,
    value: item.value,
    fill: colorMap[item.name] || '#94a3b8'
  }))
}

const mapPieData = (ticket_categories) => {
  const colorMap = {
    'Hardware': '#8b5cf6',
    'Software': '#3b82f6',
    'Access': '#06b6d4',
    'Network': '#10b981'
  }
  return ticket_categories.map((item, idx) => {
    const defaultColors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']
    return {
      name: item.name || 'Uncategorized',
      value: item.value,
      color: colorMap[item.name] || defaultColors[idx % defaultColors.length]
    }
  })
}

// ── Components ────────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl ${className}`}>
    {children}
  </div>
)

const SectionTitle = ({ title }) => (
  <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
    <div className="w-1.5 h-6 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
    {title}
  </h2>
)

export default function Dashboard() {
  const [date, setDate] = useState('')
  
  // State for backend data
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [summaryData, setSummaryData] = useState(null)
  const [activityData, setActivityData] = useState([])
  const [chartsData, setChartsData] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summary, activity, charts] = await Promise.all([
        getDashboardSummary(),
        getDashboardActivity(),
        getDashboardCharts()
      ])
      
      setSummaryData(summary)
      setActivityData(activity)
      setChartsData(charts)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('Failed to load dashboard data. Please check your connection to the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const d = new Date()
    setDate(d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    fetchData()
  }, [])

  // Derived state mappings
  const statsCards = mapSummaryToStats(summaryData)
  const timelineData = mapActivityData(activityData)
  const barData = chartsData ? mapBarData(chartsData.incident_severity) : []
  const pieData = chartsData ? mapPieData(chartsData.ticket_categories) : []

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── TOP SECTION ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Admin Dashboard
            <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              CyberDesk Enterprise
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">{date}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-[#0a0f1c]/80 border border-white/10 hover:border-white/30 text-slate-300 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="relative p-2 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
            <Bell size={20} className="text-slate-300" />
            <span className="absolute top-1 right-1.5 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.8)] animate-pulse" />
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">System Admin</p>
              <p className="text-xs text-cyan-400">Online</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[2px] shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <div className="w-full h-full rounded-full bg-[#0a0f1c] flex items-center justify-center text-xs font-bold text-white">
                AD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── ERROR STATE ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
          <ShieldAlert className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-400">Connection Error</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* ── SECTION 1: STATS CARDS ── */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading && !summaryData ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="bg-[#0a0f1c]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg animate-pulse flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 w-full">
                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                    <div className="h-8 bg-white/10 rounded w-1/3"></div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex-shrink-0"></div>
                </div>
                <div className="h-3 bg-white/10 rounded w-2/3"></div>
              </div>
            ))
          ) : (
            statsCards.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`bg-[#0a0f1c]/60 backdrop-blur-xl border ${stat.border} rounded-2xl p-5 shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 cursor-pointer group`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon size={22} />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-4 font-medium">{stat.trend}</p>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* ── SECTION 2 & 3: CHARTS AND TIMELINE ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Charts Container */}
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <SectionTitle title="Security & Operations Overview" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[300px]">
              
              {/* Bar Chart */}
              <div className="h-full flex flex-col">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4 text-center">Incident Severity Distribution</h3>
                <div className="flex-1 min-h-0 relative flex items-center justify-center">
                  {loading && !chartsData ? (
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  ) : barData.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No incident data available.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {barData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Pie Chart */}
              <div className="h-full flex flex-col">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4 text-center">IT Tickets by Category</h3>
                <div className="flex-1 min-h-0 relative flex items-center justify-center">
                  {loading && !chartsData ? (
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  ) : pieData.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No ticket data available.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-white">
                          {pieData.reduce((acc, curr) => acc + curr.value, 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
                      </div>
                    </>
                  )}
                </div>
                {/* Legend */}
                {pieData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-4 mt-2">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </Card>
        </div>

        {/* Recent Activity Timeline */}
        <div className="xl:col-span-1">
          <Card className="h-full">
            <SectionTitle title="Recent Activity" />
            
            {loading && timelineData.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 space-y-3">
                 <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                 <p className="text-xs text-slate-400 uppercase tracking-widest">Loading Activity...</p>
               </div>
            ) : timelineData.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 space-y-3 opacity-50">
                 <Activity className="w-8 h-8 text-slate-500" />
                 <p className="text-sm text-slate-400">No recent activity found.</p>
               </div>
            ) : (
              <div className="relative pl-3 space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-white/10 before:to-transparent max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {timelineData.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative flex items-start gap-4"
                  >
                    <div className={`absolute left-[-23px] w-6 h-6 rounded-full border-[3px] border-[#0a0f1c] ${item.bg} ${item.color} flex items-center justify-center shadow-lg z-10`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </div>
                    <div className="ml-2 bg-white/5 border border-white/5 rounded-xl p-4 w-full hover:bg-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-slate-200">{item.title}</h4>
                        <item.icon size={14} className={item.color} />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{item.description}</p>
                      <p className="text-[10px] text-slate-500 mt-2">{item.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* ── SECTION 4, 5 & 6: QUICK ACTIONS, SYSTEM STATUS & VOICE ASSISTANT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <SectionTitle title="Quick Actions" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {QUICK_ACTIONS.map((action, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all group"
                >
                  <action.icon size={24} className="text-slate-400 group-hover:text-cyan-400 mb-3 transition-colors" />
                  <span className="text-xs font-semibold text-center leading-tight">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </Card>
        </div>

        {/* System Status */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <SectionTitle title="System Status" />
            <div className="grid grid-cols-2 gap-4">
              {SYSTEM_STATUS.map((sys, idx) => (
                <div key={idx} className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="relative mb-2">
                    <sys.icon size={20} className="text-slate-400" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse" />
                  </div>
                  <p className="text-xs font-medium text-slate-300 mb-1">{sys.label}</p>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">{sys.status}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>

    </div>
  )
}

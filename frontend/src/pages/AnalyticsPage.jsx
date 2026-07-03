import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  Download, Calendar, TrendingUp, TrendingDown, 
  ShieldAlert, CheckCircle2, Clock, BrainCircuit, BookOpen, ShieldCheck,
  Award, AlertTriangle, Bug, KeyRound, ArrowRight, Activity, Cpu, Users, Ticket
} from 'lucide-react'

import { getIncidents } from '../api/incidents'
import { getTickets } from '../api/tickets'
import { getUsers } from '../api/users'
import { getPasswordRequests } from '../api/passwordReset'

// ── Components ────────────────────────────────────────────────────────────────

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative ${className}`}>
    {children}
  </div>
)

const SectionTitle = ({ title, icon: Icon }) => (
  <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-widest">
    {Icon && <Icon size={16} className="text-cyan-400" />}
    {title}
  </h2>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a]/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md z-50 relative">
        <p className="text-xs font-bold text-slate-300 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const EmptyChartState = ({ message }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
    <p className="text-sm text-slate-500 font-medium bg-[#0a0f1c]/90 px-4 py-2 rounded-lg backdrop-blur-md border border-white/5 shadow-2xl">{message}</p>
  </div>
)

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('Last 6 Months')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [incidents, setIncidents] = useState([])
  const [tickets, setTickets] = useState([])
  const [users, setUsers] = useState([])
  const [pwRequests, setPwRequests] = useState([])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [inc, tkt, usr, pwr] = await Promise.all([
        getIncidents().catch(() => []),
        getTickets().catch(() => []),
        getUsers().catch(() => []),
        getPasswordRequests().catch(() => [])
      ])
      setIncidents(inc)
      setTickets(tkt)
      setUsers(usr)
      setPwRequests(pwr)
    } catch (err) {
      console.error(err)
      setError('Failed to load analytics data. Please ensure the backend is reachable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Derived Stats
  const stats = useMemo(() => {
    const totalIncidents = incidents.length
    const openIncidents = incidents.filter(i => i.status !== 'Resolved' && i.status !== 'Closed').length
    
    const totalTickets = tickets.length
    const openTickets = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length

    return [
      { label: 'Total Incidents', value: totalIncidents.toLocaleString(), trend: `${openIncidents} Open`, isPositive: openIncidents === 0, icon: ShieldAlert, color: 'text-red-400' },
      { label: 'Total Tickets', value: totalTickets.toLocaleString(), trend: `${openTickets} Open`, isPositive: openTickets === 0, icon: Ticket, color: 'text-blue-400' },
      { label: 'Total Users', value: users.length.toLocaleString(), trend: 'Active', isPositive: true, icon: Users, color: 'text-emerald-400' },
      { label: 'AI Success Rate', value: 'Coming Soon', trend: 'Data Pending', isPositive: true, icon: BrainCircuit, color: 'text-purple-400' },
      { label: 'Training Completion', value: 'Coming Soon', trend: 'Data Pending', isPositive: true, icon: BookOpen, color: 'text-amber-400' },
      { label: 'Security Score', value: 'Not Yet Available', trend: 'Data Pending', isPositive: true, icon: ShieldCheck, color: 'text-cyan-400' },
    ]
  }, [incidents, tickets, users])

  // Monthly Trends
  const monthlyTrends = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dataMap = {}
    
    const processDate = (dateStr, key) => {
      if (!dateStr) return
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`
      if (!dataMap[label]) dataMap[label] = { name: label, incidents: 0, tickets: 0, resets: 0, users: 0, _date: d }
      dataMap[label][key]++
    }

    incidents.forEach(i => processDate(i.created_at, 'incidents'))
    tickets.forEach(t => processDate(t.created_at, 'tickets'))
    // Assuming users don't have created_at populated robustly, we map what we have
    users.forEach(u => processDate(u.created_at || new Date().toISOString(), 'users'))
    pwRequests.forEach(p => processDate(p.created_at, 'resets'))

    const arr = Object.values(dataMap).sort((a, b) => a._date - b._date)
    return arr.length > 0 ? arr.slice(-6) : []
  }, [incidents, tickets, users, pwRequests])

  // Threat Distribution
  const threatDist = useMemo(() => {
    const map = {}
    incidents.forEach(i => {
      const cat = i.category || 'Unknown'
      map[cat] = (map[cat] || 0) + 1
    })
    const colors = ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#10b981']
    return Object.entries(map).map(([name, value], idx) => ({
      name, value, color: colors[idx % colors.length]
    })).sort((a,b) => b.value - a.value)
  }, [incidents])

  // Role Distribution
  const roleDist = useMemo(() => {
    const map = {}
    users.forEach(u => {
      const role = u.role || 'Unassigned'
      map[role] = (map[role] || 0) + 1
    })
    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']
    return Object.entries(map).map(([name, value], idx) => ({
      name: name.toUpperCase(), value, color: colors[idx % colors.length]
    })).sort((a,b) => b.value - a.value)
  }, [users])

  const totalThreats = threatDist.reduce((acc, curr) => acc + curr.value, 0)
  const totalRoles = roleDist.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" />
            <div>
              <p className="text-sm font-bold text-red-400">Error</p>
              <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={fetchData} className="px-4 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500 hover:text-white transition-all">Retry</button>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Analytics
            <span className="text-[10px] font-bold px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              Intelligence
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Organization security insights and behavioral trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <Calendar size={16} className="text-slate-400 mr-2" />
            <select 
              value={dateRange} 
              onChange={e => setDateRange(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-slate-200 cursor-pointer"
            >
              <option>Last 30 Days</option>
              <option>Last 3 Months</option>
              <option>Last 6 Months</option>
              <option>Year to Date</option>
            </select>
          </div>
          <button className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <Download size={16} /> Export Report
          </button>
        </div>
      </header>

      {/* ── AI INSIGHTS (HERO CARD) ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0a0f1c] to-[#0f172a] border border-cyan-500/20 rounded-2xl p-6 lg:p-8 shadow-[0_0_40px_rgba(34,211,238,0.05)]">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                <Cpu size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">AI Observations</h2>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Auto-generated Security Context</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1">
              <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex items-start gap-3">
                <Activity size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300 leading-relaxed font-mono">
                  Analytics insights will become available once sufficient historical data has been collected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── OVERVIEW STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
           <>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-[#0a0f1c]/80 border border-white/10 rounded-2xl p-5 h-[120px] animate-pulse">
                <div className="w-8 h-8 bg-white/10 rounded mb-4"></div>
                <div className="h-6 w-1/2 bg-white/10 rounded"></div>
              </div>
            ))}
           </>
        ) : (
          stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
                {stat.trend !== 'Data Pending' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    stat.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {stat.trend}
                  </span>
                )}
                {stat.trend === 'Data Pending' && (
                   <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 flex items-center gap-1">
                     <Clock size={10} /> Pending
                   </span>
                )}
              </div>
              <div>
                <p className={`text-2xl font-black ${stat.value.includes('Soon') || stat.value.includes('Available') ? 'text-sm text-slate-500 h-[32px] flex items-center' : 'text-white h-[32px] flex items-center'}`}>{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ── CHARTS ROW 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Incident Trends */}
        <Card className="xl:col-span-2 h-[350px] flex flex-col">
          <SectionTitle title="Incident & Ticket Trends" icon={Activity} />
          {monthlyTrends.length === 0 && <EmptyChartState message="Not enough historical data collected yet." />}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Area type="monotone" dataKey="incidents" name="Security Incidents" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorIncidents)" />
                <Area type="monotone" dataKey="tickets" name="IT Tickets" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Threats */}
        <Card className="h-[350px] flex flex-col">
          <SectionTitle title="Threat Categories" icon={Bug} />
          {threatDist.length === 0 && <EmptyChartState message="No threats recorded." />}
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={threatDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {threatDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-white">
                {totalThreats}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
            </div>
          </div>
          <div className="mt-4 space-y-2 overflow-y-auto custom-scrollbar max-h-[80px]">
            {threatDist.map((threat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs pr-2">
                <div className="flex items-center gap-2 text-slate-300">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: threat.color }} />
                  <span className="truncate w-32">{threat.name}</span>
                </div>
                <span className="font-bold text-white">{threat.value}</span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* ── CHARTS ROW 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Growth */}
        <Card className="h-[300px] flex flex-col">
          <SectionTitle title="User Growth" icon={TrendingUp} />
          {monthlyTrends.length === 0 && <EmptyChartState message="Not enough historical data collected yet." />}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="users" name="Active Users" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#0a0f1c', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Password Reset Trends */}
        <Card className="h-[300px] flex flex-col">
          <SectionTitle title="Password Resets" icon={KeyRound} />
          {monthlyTrends.length === 0 && <EmptyChartState message="Not enough historical data collected yet." />}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="resets" name="Reset Requests" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* User Role Distribution */}
        <Card className="h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <SectionTitle title="User Role Distribution" icon={Users} />
          </div>
          {roleDist.length === 0 && <EmptyChartState message="No users found." />}
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {roleDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-white">
                {totalRoles}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar max-h-[80px]">
            {roleDist.map((role, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: role.color }} />
                <span className="text-slate-300 font-bold truncate">{role.name} ({role.value})</span>
              </div>
            ))}
          </div>
        </Card>

      </div>

    </div>
  )
}

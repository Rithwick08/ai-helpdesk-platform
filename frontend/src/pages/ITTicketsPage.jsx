import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, Plus, Filter, Monitor,
  ChevronDown, ChevronUp, Bot, User, Clock, AlertTriangle,
  Server, Shield, CheckCircle2, AlertCircle, ArrowUpRight, BarChart2,
  Trash2, Edit2, Maximize2, X, Download, HardDrive, Cpu, FileText, Smartphone,
  Loader2
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import { getTickets, resolveTicket, escalateTicket, closeTicket, getTicketHistory } from '../api/tickets'

// ── Components ────────────────────────────────────────────────────────────────

const Badge = ({ children, colorClass }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
    {children}
  </span>
)

const PriorityBadge = ({ level }) => {
  const styles = {
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
    High: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return <Badge colorClass={styles[level] || styles.Medium}>{level}</Badge>
}

const StatusBadge = ({ status }) => {
  const styles = {
    'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Resolved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Escalated': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }
  return <Badge colorClass={styles[status] || styles.Open}>{status}</Badge>
}

const TicketCard = ({ ticket, isExpanded, onToggle, historyData, onUpdateStatus, isProcessing }) => {
  return (
    <motion.div 
      layout
      className={`bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-colors ${isExpanded ? 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'hover:border-white/20 hover:bg-[#0a0f1c]'}`}
    >
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono font-bold text-blue-400">{ticket.id}</span>
            <PriorityBadge level={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition-colors">{ticket.title}</h3>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="hidden md:block">
            <p className="font-semibold text-slate-300 mb-0.5">{ticket.employee}</p>
            <p className="text-[10px] uppercase tracking-widest">{ticket.department}</p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock size={12} />
              <span className="font-semibold text-slate-300">{ticket.createdAt}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest">Submitted</p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5 mb-0.5">
              <User size={12} />
              <span className="font-semibold text-slate-300">{ticket.assignedTo}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest">Assignee</p>
          </div>
          <div className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors group-hover:bg-blue-500/20 group-hover:text-blue-400">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-black/20"
          >
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FileText size={14} /> Problem Description
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                    {ticket.description}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Category</p>
                       <p className="text-xs font-bold text-white truncate">{ticket.category}</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex items-center gap-2">
                       <Monitor size={16} className="text-slate-400" />
                       <div>
                         <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Device</p>
                         <p className="text-xs font-bold text-white truncate">{ticket.device}</p>
                       </div>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex items-center gap-2">
                       <Cpu size={16} className="text-slate-400" />
                       <div>
                         <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">OS</p>
                         <p className="text-xs font-bold text-slate-300 truncate">{ticket.os}</p>
                       </div>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Bot size={14} /> AI Diagnosis
                    </h4>
                    <p className="text-sm text-blue-300/80 leading-relaxed">{ticket.aiDiagnosis}</p>
                  </div>
                  
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <CheckCircle2 size={14} /> Recommended Fix
                    </h4>
                    <p className="text-sm text-emerald-300/80 leading-relaxed">{ticket.recommendedFix}</p>
                    {ticket.resolutionSteps.length > 0 && (
                      <ul className="text-xs text-emerald-200/60 mt-2 list-disc list-inside">
                        {ticket.resolutionSteps.map((step, i) => <li key={i}>{step}</li>)}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button 
                    disabled={isProcessing || ticket.status === 'Resolved' || ticket.status === 'Closed'}
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(ticket.rawId, 'resolve'); }}
                    className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Resolve
                  </button>
                  <button 
                    disabled={isProcessing || ticket.status === 'Escalated' || ticket.status === 'Closed'}
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(ticket.rawId, 'escalate'); }}
                    className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <ArrowUpRight size={16} /> Escalate
                  </button>
                  <button 
                    disabled={isProcessing || ticket.status === 'Closed'}
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(ticket.rawId, 'close'); }}
                    className="px-4 py-2 bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 border border-slate-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <X size={16} /> Close Ticket
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock size={14} /> Ticket History
                  </h4>
                  <div className="relative pl-3 space-y-4 before:absolute before:inset-0 before:ml-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
                    {!historyData ? (
                      <p className="text-xs text-slate-500 animate-pulse">Loading history...</p>
                    ) : historyData.length === 0 ? (
                      <p className="text-xs text-slate-500">No history available.</p>
                    ) : historyData.map((item, i) => (
                      <div key={i} className="relative flex items-start gap-3">
                        <div className="absolute left-[-15px] w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)] mt-1.5" />
                        <div className="ml-2">
                          <p className="text-[10px] font-mono text-blue-400 mb-0.5">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-300">{item.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {ticket.internalNotes && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Shield size={14} /> Internal Notes
                    </h4>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-200/80 italic">{ticket.internalNotes}</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const mapTicket = (backendData) => ({
  id: backendData.id ? `TKT-${backendData.id.toString().padStart(4, '0')}` : 'TKT-0000',
  rawId: backendData.id,
  title: backendData.title || 'Untitled Issue',
  employee: backendData.created_by ? `User ID ${backendData.created_by}` : 'Unknown User',
  department: 'Unknown Dept',
  priority: backendData.priority || 'Medium',
  status: backendData.status || 'Open',
  category: backendData.category || 'Unknown',
  assignedTo: backendData.assigned_to ? `Engineer ${backendData.assigned_to}` : 'Unassigned',
  createdAt: backendData.created_at ? new Date(backendData.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
  description: backendData.description || 'No description provided',
  device: 'Unknown Device',
  os: 'Unknown OS',
  aiDiagnosis: backendData.diagnosis || 'Pending Analysis',
  recommendedFix: backendData.recommended_fix || 'Pending Recommendation',
  resolutionSteps: backendData.resolution_steps ? backendData.resolution_steps.replace(/\[|\]|'/g, '').split(',').filter(Boolean) : [],
  internalNotes: ''
})

export default function ITTicketsPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [expandedId, setExpandedId] = useState(null)
  const [historyCache, setHistoryCache] = useState({})

  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const fetchAllTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTickets()
      setTickets(data.map(mapTicket))
    } catch (err) {
      console.error('Fetch tickets error:', err)
      setError('Failed to load IT tickets from the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllTickets()
  }, [])

  const handleToggleExpand = async (ticketId, rawId) => {
    if (expandedId === ticketId) {
      setExpandedId(null)
    } else {
      setExpandedId(ticketId)
      if (!historyCache[rawId]) {
        try {
          const history = await getTicketHistory(rawId)
          setHistoryCache(prev => ({ ...prev, [rawId]: history }))
        } catch (err) {
          console.error('Failed to load history for ticket:', rawId)
          setHistoryCache(prev => ({ ...prev, [rawId]: [] }))
        }
      }
    }
  }

  const handleUpdateStatus = async (rawId, action) => {
    setIsProcessing(true)
    try {
      if (action === 'resolve') await resolveTicket(rawId)
      if (action === 'escalate') await escalateTicket(rawId)
      if (action === 'close') await closeTicket(rawId)
      
      // Clear history cache for this ticket so it refreshes next time
      setHistoryCache(prev => {
        const next = { ...prev }
        delete next[rawId]
        return next
      })

      await fetchAllTickets()
    } catch (err) {
      alert('Failed to execute action on ticket')
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredTickets = useMemo(() => {
    let result = tickets
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.id.toLowerCase().includes(q) || 
        t.employee.toLowerCase().includes(q)
      )
    }
    if (priorityFilter !== 'All') result = result.filter(t => t.priority === priorityFilter)
    if (statusFilter !== 'All') result = result.filter(t => t.status === statusFilter)
    return result
  }, [tickets, searchQuery, priorityFilter, statusFilter])

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length
    const resolved = tickets.filter(t => t.status === 'Resolved').length
    const critical = tickets.filter(t => t.priority === 'Critical').length
    const escalations = tickets.filter(t => t.status === 'Escalated').length
    return { total, open, resolved, critical, escalations }
  }, [tickets])

  const priorityChart = [
    { name: 'Critical', value: stats.critical, color: '#ef4444' },
    { name: 'High', value: tickets.filter(t => t.priority === 'High').length, color: '#f97316' },
    { name: 'Medium', value: tickets.filter(t => t.priority === 'Medium').length, color: '#3b82f6' },
    { name: 'Low', value: tickets.filter(t => t.priority === 'Low').length, color: '#10b981' },
  ]

  const categoryChart = useMemo(() => {
    const counts = {}
    tickets.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1 })
    const colors = ['#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b', '#10b981']
    return Object.entries(counts).map(([name, value], idx) => ({
      name, value, fill: colors[idx % colors.length]
    }))
  }, [tickets])

  const monthlyChart = [
    { name: 'Jan', tickets: 120 },
    { name: 'Feb', tickets: 150 },
    { name: 'Mar', tickets: 180 },
    { name: 'Apr', tickets: 140 },
    { name: 'May', tickets: 190 },
    { name: 'Jun', tickets: tickets.length + 50 },
  ]

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-blue-500/30 text-slate-300">
      
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            IT Ticket Management
            <span className="text-[10px] font-bold px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(59,130,246,0.2)]">
              ServiceNow Inspired
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitor and manage all employee IT support requests.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <Download size={16} /> Export
          </button>
          <button onClick={fetchAllTickets} disabled={loading} className="p-2 rounded-lg bg-[#0a0f1c]/80 border border-white/10 hover:border-white/30 text-slate-300 transition-colors disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2 opacity-50 cursor-not-allowed" title="Use the Employee Portal to create real tickets">
            <Plus size={18} /> Create Ticket
          </button>
        </div>
      </header>

      {/* ── ERROR STATE ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
          <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-400">Connection Error</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
          <button onClick={fetchAllTickets} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Tickets', val: stats.total.toString(), icon: FileText, color: 'text-blue-400' },
          { label: 'Open Tickets', val: stats.open.toString(), icon: Clock, color: 'text-amber-400' },
          { label: 'Resolved Today', val: stats.resolved.toString(), icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Critical Priority', val: stats.critical.toString(), icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Pending Escalations', val: stats.escalations.toString(), icon: AlertCircle, color: 'text-orange-400' },
          { label: 'SLA Compliance', val: tickets.length > 0 ? '98.5%' : '0%', icon: Shield, color: 'text-cyan-400' },
        ].map((card, i) => (
           <div key={i} className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-white/20 transition-colors group">
             <div className="flex justify-between items-start mb-2">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</p>
               <card.icon size={16} className={`${card.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
             </div>
             <p className={`text-2xl font-black ${card.color}`}>{card.val}</p>
           </div>
        ))}
      </div>

      {/* ── TOP CHARTS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-64">
        
        <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertCircle size={14} /> Priority Distribution
          </h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityChart} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                  {priorityChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Monitor size={14} /> Tickets by Category
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChart} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {categoryChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart2 size={14} /> Monthly Volume
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChart} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── FILTER BAR ── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-[#0a0f1c]/60 backdrop-blur-md border border-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-slate-400 mr-2">
          <Filter size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ID, Title, or Name..." 
            className="pl-9 pr-4 py-1.5 bg-[#1e293b]/50 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors w-64"
          />
        </div>

        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-3 py-1.5 bg-[#1e293b]/50 border border-white/10 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 transition-colors appearance-none">
          <option value="All">All Priority</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 bg-[#1e293b]/50 border border-white/10 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 transition-colors appearance-none">
          <option value="All">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Escalated">Escalated</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* ── MAIN CONTENT & RIGHT PANEL ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Col: Tickets List */}
        <div className="xl:col-span-3 space-y-4">
          {loading ? (
             Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 animate-pulse flex flex-col gap-4">
                <div className="flex justify-between">
                  <div className="w-1/2 h-6 bg-white/5 rounded"></div>
                  <div className="w-1/4 h-6 bg-white/5 rounded"></div>
                </div>
                <div className="w-3/4 h-4 bg-white/5 rounded"></div>
              </div>
            ))
          ) : filteredTickets.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 bg-white/5 border border-white/5 rounded-2xl border-dashed">
              <Monitor size={48} className="mb-4 opacity-30 text-blue-500" />
              <h3 className="text-lg font-bold text-slate-300 mb-1">No IT Tickets Found</h3>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredTickets.map((ticket) => (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  isExpanded={expandedId === ticket.id}
                  onToggle={() => handleToggleExpand(ticket.id, ticket.rawId)}
                  historyData={historyCache[ticket.rawId]}
                  onUpdateStatus={handleUpdateStatus}
                  isProcessing={isProcessing}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Right Col: IT Operations Summary */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl sticky top-8">
            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-widest">
              <Server size={16} className="text-blue-400" /> IT Operations Center
            </h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Pending Escalations</p>
                <div className="space-y-3">
                  {tickets.filter(t => t.status === 'Escalated').slice(0, 3).map(esc => (
                    <div key={esc.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl hover:bg-red-500/10 cursor-pointer transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-mono font-bold text-red-400">{esc.id}</span>
                        <span className="text-[10px] text-slate-500">{esc.createdAt}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium truncate">{esc.title}</p>
                    </div>
                  ))}
                  {tickets.filter(t => t.status === 'Escalated').length === 0 && (
                    <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-center">No pending escalations.</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Engineer Workload</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">Unassigned</span>
                    <span className="text-blue-400 font-bold">{tickets.filter(t => t.assignedTo === 'Unassigned').length} pending</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  )
}

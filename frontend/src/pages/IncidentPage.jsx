import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, Plus, Filter, ShieldAlert,
  ChevronDown, ChevronUp, Bot, User, Clock, AlertTriangle,
  FileSearch, Lock, CheckCircle2, AlertCircle, ArrowUpRight, BarChart2,
  Trash2, UploadCloud, Edit2, Maximize2, X, Download, Activity, Loader2
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import { getIncidents, createIncident, updateIncident, deleteIncident } from '../api/incidents'

// ── Components ────────────────────────────────────────────────────────────────

const Badge = ({ children, colorClass }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
    {children}
  </span>
)

const SeverityBadge = ({ level }) => {
  const styles = {
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
    High: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return <Badge colorClass={styles[level] || styles.Medium}>{level}</Badge>
}

const StatusBadge = ({ status }) => {
  const styles = {
    'Open': 'bg-red-500/10 text-red-400 border-red-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Resolved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return <Badge colorClass={styles[status] || styles.Open}>{status}</Badge>
}

const IncidentCard = ({ incident, isExpanded, onToggle, onViewDetails, onUpdateStatus, isProcessing }) => {
  return (
    <motion.div 
      layout
      className={`bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-colors ${isExpanded ? 'border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'hover:border-white/20 hover:bg-[#0a0f1c]'}`}
    >
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono font-bold text-cyan-400">INC-{incident.id}</span>
            <SeverityBadge level={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">{incident.title}</h3>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="hidden md:block">
            <p className="font-semibold text-slate-300 mb-0.5">{incident.category}</p>
            <p className="text-[10px] uppercase tracking-widest">Category</p>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Bot size={12} className={incident.confidence >= 90 ? 'text-red-400' : 'text-amber-400'} />
              <span className="font-semibold text-slate-300">{incident.confidence}%</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest">AI Confidence</p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock size={12} />
              <span className="font-semibold text-slate-300">{incident.createdAt}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest">Detected</p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5 mb-0.5">
              <User size={12} />
              <span className="font-semibold text-slate-300">{incident.analyst}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest">Assignee</p>
          </div>
          <div className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors group-hover:bg-cyan-500/20 group-hover:text-cyan-400">
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
                    <FileSearch size={14} /> Description & Context
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                    {incident.description}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Affected User</p>
                       <p className="text-xs font-bold text-white truncate">{incident.affectedUser}</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Affected Device</p>
                       <p className="text-xs font-bold text-white truncate">{incident.affectedDevice}</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">MITRE ATT&CK</p>
                       <p className="text-xs font-bold text-red-400 truncate">{incident.mitre}</p>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Lock size={14} /> Recommended Containment
                    </h4>
                    <p className="text-sm text-emerald-300/80">{incident.containment}</p>
                  </div>
                  
                  <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Bot size={14} /> AI Recovery Analysis
                    </h4>
                    <ul className="text-sm text-cyan-300/80 list-disc list-inside space-y-1">
                      {incident.aiRecommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button 
                    disabled={isProcessing || incident.status === 'Resolved'}
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(incident.id, 'Resolved'); }}
                    className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Resolve
                  </button>
                  <button 
                    disabled={isProcessing || incident.status === 'In Progress'}
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(incident.id, 'In Progress'); }}
                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <ArrowUpRight size={16} /> Mark In Progress
                  </button>
                  <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <User size={16} /> Assign
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onViewDetails(incident); }} className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ml-auto">
                    <Maximize2 size={16} /> Full Details
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock size={14} /> Timeline
                  </h4>
                  <div className="relative pl-3 space-y-4 before:absolute before:inset-0 before:ml-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
                    {incident.timeline.map((item, i) => (
                      <div key={i} className="relative flex items-start gap-3">
                        <div className="absolute left-[-15px] w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)] mt-1.5" />
                        <div className="ml-2">
                          <p className="text-[10px] font-mono text-cyan-400 mb-0.5">{item.time}</p>
                          <p className="text-xs text-slate-300">{item.event}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FileSearch size={14} /> Evidence Artifacts
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {incident.evidence.map((file, i) => (
                      <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-400/50 cursor-pointer transition-colors">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const DetailModal = ({ incident, onClose, onDelete, onUpdateStatus, isProcessing }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div 
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.95 }}
        className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-[0_0_50px_rgba(34,211,238,0.15)] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-cyan-900/20 to-transparent">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-red-500/20 rounded-xl">
               <ShieldAlert size={24} className="text-red-400" />
             </div>
             <div>
               <h2 className="text-xl font-black text-white">{incident.title}</h2>
               <p className="text-xs text-cyan-400 font-mono mt-1">INC-{incident.id} • Detected {incident.createdAt}</p>
             </div>
          </div>
          <button disabled={isProcessing} onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg transition-colors disabled:opacity-50"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Top Metadata Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Current Status</p>
              <StatusBadge status={incident.status} />
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Severity</p>
              <SeverityBadge level={incident.severity} />
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Assigned Analyst</p>
              <p className="text-sm font-bold text-white flex items-center gap-2"><User size={14} className="text-cyan-400"/> {incident.analyst}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">AI Confidence</p>
              <p className="text-sm font-bold text-white flex items-center gap-2"><Bot size={14} className="text-cyan-400"/> {incident.confidence}% Match</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Full Description</h3>
                <p className="text-sm text-slate-300 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">{incident.description}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Investigation Notes</h3>
                <textarea className="w-full h-24 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none placeholder-slate-600" placeholder="Add investigation notes..." />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Attachments & Evidence</h3>
                <div className="bg-black/20 p-6 rounded-xl border border-white/5 border-dashed flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer">
                  <UploadCloud size={32} className="text-slate-500 mb-3" />
                  <p className="text-sm font-bold text-slate-300">Drag & drop evidence files</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {incident.evidence.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                      <div className="flex items-center gap-3">
                        <FileSearch size={16} className="text-cyan-400" />
                        <span className="text-xs font-mono text-slate-300">{ev}</span>
                      </div>
                      <Download size={14} className="text-slate-500 hover:text-white cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-white/10 bg-black/40 flex justify-between items-center">
          <button 
            disabled={isProcessing}
            onClick={() => onDelete(incident.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
             <Trash2 size={16} /> Delete Incident
          </button>
          <div className="flex gap-3">
            <button disabled={isProcessing} onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50">
              Close
            </button>
            {incident.status !== 'Resolved' && (
              <button 
                disabled={isProcessing}
                onClick={() => onUpdateStatus(incident.id, 'Resolved')}
                className="px-6 py-2 text-sm font-bold text-black bg-cyan-500 hover:bg-cyan-400 rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle2 size={16}/> Resolve Incident
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  )
}

const CreateIncidentModal = ({ onClose, onSave, isProcessing }) => {
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Authentication', severity: 'Medium' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-md shadow-[0_0_40px_rgba(34,211,238,0.1)] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Plus size={18} className="text-cyan-400" /> Report Incident
          </h3>
          <button disabled={isProcessing} onClick={onClose} className="text-slate-400 hover:text-white disabled:opacity-50"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Incident Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" 
              placeholder="e.g. Suspicious Login Activity" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description & Context</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full h-32 bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none" 
              placeholder="Describe what happened..." 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option>Authentication</option>
                <option>Malware</option>
                <option>Exfiltration</option>
                <option>Phishing</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Severity</label>
              <select 
                value={formData.severity}
                onChange={e => setFormData({...formData, severity: e.target.value})}
                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-black/20">
          <button disabled={isProcessing} onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-50">Cancel</button>
          <button 
            disabled={isProcessing || !formData.title || !formData.description}
            onClick={() => onSave(formData)} 
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            Submit Incident
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const mapIncident = (backendData) => ({
  id: backendData.id,
  title: backendData.title || 'Untitled Incident',
  description: backendData.description || 'No description provided',
  category: backendData.category || 'Unknown',
  severity: backendData.severity || 'Medium',
  confidence: backendData.confidence_score ? Math.round(backendData.confidence_score * 100) : 0,
  status: backendData.status || 'Open',
  createdAt: backendData.created_at ? new Date(backendData.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
  analyst: 'Unassigned',
  timeline: [
    { time: backendData.created_at ? new Date(backendData.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(), event: 'Incident Detected' }
  ],
  evidence: ['system_logs.json'],
  containment: 'Pending analysis.',
  aiRecommendations: ['Investigate source IP', 'Isolate affected systems'],
  affectedUser: 'Unknown User',
  affectedDevice: 'Unknown Device',
  mitre: 'T1000 - Unknown'
})

export default function IncidentPage() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [expandedId, setExpandedId] = useState(null)
  
  // UI Modals
  const [isAdding, setIsAdding] = useState(false)
  const [detailIncident, setDetailIncident] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const fetchIncidents = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getIncidents()
      setIncidents(data.map(mapIncident))
    } catch (err) {
      console.error('Fetch incidents error:', err)
      setError('Failed to load security incidents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncidents()
  }, [])

  const filteredIncidents = useMemo(() => {
    let result = incidents
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i => (i.title && i.title.toLowerCase().includes(q)) || (i.description && i.description.toLowerCase().includes(q)))
    }
    if (severityFilter !== 'All') result = result.filter(i => i.severity === severityFilter)
    if (statusFilter !== 'All') result = result.filter(i => i.status === statusFilter)
    return result
  }, [incidents, searchQuery, severityFilter, statusFilter])

  const stats = useMemo(() => {
    const open = incidents.filter(i => i.status === 'Open' || i.status === 'In Progress').length
    const resolved = incidents.filter(i => i.status === 'Resolved').length
    const critical = incidents.filter(i => i.severity === 'Critical').length
    const high = incidents.filter(i => i.severity === 'High').length
    const medium = incidents.filter(i => i.severity === 'Medium').length
    const low = incidents.filter(i => i.severity === 'Low').length
    return { open, resolved, critical, high, medium, low }
  }, [incidents])

  const severityChart = [
    { name: 'Critical', value: stats.critical, color: '#ef4444' },
    { name: 'High', value: stats.high, color: '#f59e0b' },
    { name: 'Medium', value: stats.medium, color: '#3b82f6' },
    { name: 'Low', value: stats.low, color: '#10b981' },
  ]

  const categoryChart = useMemo(() => {
    const counts = {}
    incidents.forEach(i => {
      counts[i.category] = (counts[i.category] || 0) + 1
    })
    const colors = ['#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b', '#10b981']
    return Object.entries(counts).map(([name, value], idx) => ({
      name, value, fill: colors[idx % colors.length]
    }))
  }, [incidents])

  const monthlyChart = [
    { name: 'Jan', incidents: 45 },
    { name: 'Feb', incidents: 52 },
    { name: 'Mar', incidents: 38 },
    { name: 'Apr', incidents: 65 },
    { name: 'May', incidents: 48 },
    { name: 'Jun', incidents: incidents.length + 30 }, // Dummy variation
  ]

  const handleUpdateStatus = async (id, newStatus) => {
    setIsProcessing(true)
    try {
      await updateIncident(id, { status: newStatus })
      await fetchIncidents()
      if (detailIncident && detailIncident.id === id) {
        setDetailIncident({ ...detailIncident, status: newStatus })
      }
    } catch (err) {
      alert('Failed to update status')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this incident?')) return
    setIsProcessing(true)
    try {
      await deleteIncident(id)
      await fetchIncidents()
      setDetailIncident(null)
    } catch (err) {
      alert('Failed to delete incident')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreate = async (data) => {
    setIsProcessing(true)
    try {
      await createIncident(data)
      setIsAdding(false)
      await fetchIncidents()
    } catch (err) {
      alert('Failed to create incident')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Security Incidents
            <span className="text-[10px] font-bold px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              Defender XDR Inspired
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitor, investigate, and respond to security incidents.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <Download size={16} /> Export
          </button>
          <button 
            onClick={fetchIncidents}
            disabled={loading}
            className="p-2 rounded-lg bg-[#0a0f1c]/80 border border-white/10 hover:border-white/30 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-cyan-500 text-black font-bold text-sm rounded-lg hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2">
            <Plus size={18} /> Create Incident
          </button>
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
          <button onClick={fetchIncidents} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Open Incidents', val: stats.open.toString(), icon: ShieldAlert, color: 'text-red-400' },
          { label: 'Resolved', val: stats.resolved.toString(), icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Critical', val: stats.critical.toString(), icon: AlertTriangle, color: 'text-red-500' },
          { label: 'High Severity', val: stats.high.toString(), icon: AlertCircle, color: 'text-amber-500' },
          { label: 'Avg Res Time', val: '4h 12m', icon: Clock, color: 'text-cyan-400' },
          { label: 'Detected Today', val: (incidents.length > 0 ? 'Live' : '0'), icon: Activity, color: 'text-blue-400' },
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
            <AlertTriangle size={14} /> Severity Distribution
          </h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityChart} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                  {severityChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldAlert size={14} /> Incident Categories
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
            <BarChart2 size={14} /> Monthly Trend
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChart} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="incidents" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
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
            placeholder="Search ID, title, or description..." 
            className="pl-9 pr-4 py-1.5 bg-[#1e293b]/50 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors w-64"
          />
        </div>

        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-3 py-1.5 bg-[#1e293b]/50 border border-white/10 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors appearance-none">
          <option value="All">All Severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 bg-[#1e293b]/50 border border-white/10 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors appearance-none">
          <option value="All">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* ── MAIN CONTENT & RIGHT PANEL ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Col: Incidents List */}
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
          ) : filteredIncidents.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 bg-white/5 border border-white/5 rounded-2xl border-dashed">
              <ShieldAlert size={48} className="mb-4 opacity-30 text-cyan-500" />
              <h3 className="text-lg font-bold text-slate-300 mb-1">No Security Incidents Found</h3>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredIncidents.map((incident) => (
                <IncidentCard 
                  key={incident.id} 
                  incident={incident} 
                  isExpanded={expandedId === incident.id}
                  onToggle={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
                  onViewDetails={setDetailIncident}
                  onUpdateStatus={handleUpdateStatus}
                  isProcessing={isProcessing}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Right Col: SOC Summary Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl sticky top-8">
            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-widest">
              <Activity size={16} className="text-cyan-400" /> Analyst Queue
            </h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Critical Alerts (Unassigned)</p>
                <div className="space-y-3">
                  {incidents.filter(i => i.severity === 'Critical' && i.status !== 'Resolved').slice(0, 3).map(inc => (
                    <div key={inc.id} onClick={() => setDetailIncident(inc)} className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl hover:bg-red-500/10 cursor-pointer transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-mono font-bold text-red-400">INC-{inc.id}</span>
                        <span className="text-[10px] text-slate-500">{inc.createdAt}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium truncate">{inc.title}</p>
                    </div>
                  ))}
                  {incidents.filter(i => i.severity === 'Critical' && i.status !== 'Resolved').length === 0 && (
                     <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-center">No unassigned critical alerts.</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="bg-gradient-to-b from-cyan-500/10 to-transparent border border-cyan-500/20 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Bot size={14} /> AI Shift Briefing
                </h4>
                <p className="text-xs text-cyan-300/80 leading-relaxed">
                  System detects {stats.open} open alerts needing attention. AI recommends prioritizing resolution of critical incidents from external sources.
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAdding && <CreateIncidentModal onClose={() => setIsAdding(false)} onSave={handleCreate} isProcessing={isProcessing} />}
        {detailIncident && (
          <DetailModal 
            incident={detailIncident} 
            onClose={() => setDetailIncident(null)} 
            onDelete={handleDelete}
            onUpdateStatus={handleUpdateStatus}
            isProcessing={isProcessing}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

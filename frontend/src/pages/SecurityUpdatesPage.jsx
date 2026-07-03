import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, Plus, Filter, ChevronDown, 
  BellRing, ShieldAlert, Shield, Clock, CheckCircle2,
  AlertTriangle, MoreVertical, Edit2, Trash2, X, EyeOff,
  User, Calendar, FileText
} from 'lucide-react'
import {
  getSecurityUpdates,
  createSecurityUpdate,
  updateSecurityUpdate,
  deleteSecurityUpdate
} from '../api/securityUpdates'

// ── Enrichment ────────────────────────────────────────────────────────────────

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const STATUSES = ['Published', 'Scheduled', 'Draft', 'Unpublished']
const CATEGORIES = ['Vulnerability', 'Threat Alert', 'Maintenance', 'Policy Change', 'General Info']

function enrichUpdate(u) {
  const hash = String(u.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const categories = CATEGORIES
  const statuses = STATUSES
  const audiences = ['All Employees', 'HR & Finance', 'All Remote Workers', 'IT Staff']
  
  return {
    ...u,
    // ID formatted nicely if needed, but we can just use the backend ID
    displayId: `SEC-${String(u.id).padStart(3, '0')}`,
    category: categories[hash % categories.length],
    summary: u.message.length > 100 ? u.message.substring(0, 100) + '...' : u.message,
    content: u.message,
    status: statuses[hash % statuses.length],
    publishDate: u.created_at || new Date().toISOString(),
    lastUpdated: u.created_at || new Date().toISOString(),
    author: 'Admin User',
    audience: audiences[hash % audiences.length],
    views: 100 + (hash * 13) % 5000,
    acknowledgements: 20 + (hash * 7) % 500,
    expiryDate: new Date(new Date(u.created_at || Date.now()).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// ── Components ────────────────────────────────────────────────────────────────

const PriorityBadge = ({ priority }) => {
  const styles = {
    'Critical': 'bg-red-500/10 text-red-400 border-red-500/20',
    'High': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Medium': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Low': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[priority] || styles['Medium']}`}>
      {priority || 'Medium'}
    </span>
  )
}

const StatusBadge = ({ status }) => {
  const styles = {
    'Published': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Scheduled': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Draft': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'Unpublished': 'bg-slate-500/10 text-slate-400 border-slate-500/20 line-through',
  }
  
  const icons = {
    'Published': <CheckCircle2 size={10} />,
    'Scheduled': <Clock size={10} />,
    'Draft': <FileText size={10} />,
    'Unpublished': <EyeOff size={10} />
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles['Draft']}`}>
      {icons[status] || icons['Draft']}
      {status || 'Draft'}
    </span>
  )
}

// ── Skeleton Loader ──────────────────────────────────────────────────────────

const SkeletonLoader = () => (
  <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="h-4 w-24 bg-white/10 rounded"></div>
      <div className="h-4 w-16 bg-white/10 rounded"></div>
    </div>
    <div className="h-6 w-3/4 bg-white/10 rounded mb-2"></div>
    <div className="h-4 w-1/4 bg-white/10 rounded mb-4"></div>
    <div className="space-y-2 mb-6">
      <div className="h-3 w-full bg-white/10 rounded"></div>
      <div className="h-3 w-5/6 bg-white/10 rounded"></div>
    </div>
    <div className="pt-4 border-t border-white/5 flex justify-between">
      <div className="h-3 w-20 bg-white/10 rounded"></div>
      <div className="h-3 w-20 bg-white/10 rounded"></div>
    </div>
  </div>
)

// ── Modals & Drawers ─────────────────────────────────────────────────────────

const DeleteConfirmation = ({ update, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-[#0f172a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(239,68,68,0.15)]"
    >
      <div className="flex items-center gap-3 mb-4 text-red-400">
        <AlertTriangle size={24} />
        <h3 className="text-lg font-bold text-slate-100">Delete Update?</h3>
      </div>
      <p className="text-sm text-slate-300 mb-6 leading-relaxed">
        Are you sure you want to permanently delete <strong className="text-slate-100">"{update.title}"</strong>? This will remove it from all employee portals.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold hover:bg-red-500 hover:text-white transition-all">
          Delete Update
        </button>
      </div>
    </motion.div>
  </div>
)

const PublishModal = ({ isEditing, update, onClose, onSave }) => {
  const [formData, setFormData] = useState(update || {
    title: '', category: 'Vulnerability', priority: 'Medium', summary: '', content: '', status: 'Published', publishDate: new Date().toISOString().slice(0, 16)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-[0_0_40px_rgba(34,211,238,0.1)] flex flex-col my-8"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            {isEditing ? <Edit2 size={18} className="text-cyan-400" /> : <Plus size={18} className="text-cyan-400" />}
            {isEditing ? 'Edit Security Update' : 'Publish Security Update'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Announcement Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="e.g. Critical Adobe Reader Update Required"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category (Mocked on save)</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                disabled
              >
                <option value={formData.category}>{formData.category}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Priority</label>
              <select 
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value})}
                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Announcement</label>
            <textarea 
              rows={6}
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none font-mono text-xs"
              placeholder="Detailed explanation, instructions, and impact..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status (Mocked on save)</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                disabled
              >
                <option value={formData.status}>{formData.status}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Publish Date</label>
              <input 
                type="datetime-local" 
                value={formData.publishDate}
                onChange={e => setFormData({...formData, publishDate: e.target.value})}
                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-black/20">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)} 
            disabled={!formData.title || !formData.content}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all disabled:opacity-50"
          >
            {isEditing ? 'Save Changes' : 'Publish Update'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const UpdateDrawer = ({ update, onClose, onEdit, onDelete, onUnpublish }) => (
  <div className="fixed inset-0 z-40 flex justify-end">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="relative w-full max-w-lg bg-[#0a0f1c] border-l border-white/10 h-full shadow-2xl flex flex-col"
    >
      <div className="p-6 border-b border-white/10 bg-gradient-to-b from-cyan-500/5 to-transparent flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-cyan-400 font-bold">{update.displayId}</span>
            <PriorityBadge priority={update.priority} />
            <StatusBadge status={update.status} />
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">{update.title}</h2>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg flex-shrink-0"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><User size={12}/> Author</p>
            <p className="text-sm text-slate-200 font-medium">{update.author}</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><Shield size={12}/> Category</p>
            <p className="text-sm text-slate-200 font-medium">{update.category}</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><Calendar size={12}/> Published</p>
            <p className="text-sm text-slate-200 font-medium">{new Date(update.publishDate).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><Calendar size={12}/> Expires</p>
            <p className="text-sm text-slate-200 font-medium">{new Date(update.expiryDate).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Views</p>
            <p className="text-lg font-mono text-cyan-400 font-bold">{update.views}</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Acknowledgements</p>
            <p className="text-lg font-mono text-emerald-400 font-bold">{update.acknowledgements}</p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <FileText size={14} /> Full Announcement
          </h3>
          <div className="bg-white/5 border border-white/5 p-5 rounded-xl">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{update.content}</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 italic text-right">
            Last Updated: {new Date(update.lastUpdated).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="p-6 border-t border-white/10 bg-black/20 grid grid-cols-3 gap-3">
        <button onClick={onEdit} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold hover:bg-cyan-600 hover:text-white transition-colors">
          <Edit2 size={16} /> Edit
        </button>
        <button onClick={onUnpublish} disabled={update.status === 'Unpublished'} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-xl text-xs font-bold hover:bg-slate-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <EyeOff size={16} /> Unpublish
        </button>
        <button onClick={onDelete} className="flex flex-col items-center justify-center gap-1.5 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-colors">
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </motion.div>
  </div>
)

// ── Main Page Component ──────────────────────────────────────────────────────

export default function SecurityUpdatesPage() {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('All Priorities')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [sortOrder, setSortOrder] = useState('Newest')

  // UI state
  const [selectedUpdate, setSelectedUpdate] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [updateToEdit, setUpdateToEdit] = useState(null)
  const [updateToDelete, setUpdateToDelete] = useState(null)

  const fetchUpdates = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSecurityUpdates()
      setUpdates(data.map(enrichUpdate))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch updates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUpdates()
  }, [])

  // Derived Statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const now = new Date().getTime()
    return [
      { label: 'Total Updates', value: updates.length, icon: BellRing, color: 'text-cyan-400' },
      { label: 'Critical Alerts', value: updates.filter(u => u.priority === 'Critical').length, icon: ShieldAlert, color: 'text-red-400' },
      { label: 'High Priority', value: updates.filter(u => u.priority === 'High').length, icon: AlertTriangle, color: 'text-amber-400' },
      { label: 'Expired Updates', value: updates.filter(u => new Date(u.expiryDate).getTime() < now).length, icon: Clock, color: 'text-slate-400' },
      { label: 'Published This Week', value: updates.filter(u => u.status === 'Published').length, icon: CheckCircle2, color: 'text-emerald-400' },
      { label: 'Employee Reach', value: updates.reduce((acc, u) => acc + u.views, 0).toLocaleString(), icon: User, color: 'text-blue-400' },
    ]
  }, [updates])

  // Filtering Logic
  const filteredUpdates = useMemo(() => {
    let result = updates

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase()
      result = result.filter(u => u.title.toLowerCase().includes(lowerQ) || u.summary.toLowerCase().includes(lowerQ))
    }
    if (priorityFilter !== 'All Priorities') result = result.filter(u => u.priority === priorityFilter)
    if (statusFilter !== 'All Status') result = result.filter(u => u.status === statusFilter)
    if (categoryFilter !== 'All Categories') result = result.filter(u => u.category === categoryFilter)

    if (sortOrder === 'Newest') result.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
    if (sortOrder === 'Priority') {
      const weight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 }
      result.sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0))
    }
    
    return result
  }, [updates, searchQuery, priorityFilter, statusFilter, categoryFilter, sortOrder])

  // Handlers
  const handleSaveUpdate = async (data) => {
    try {
      if (updateToEdit) {
        await updateSecurityUpdate(updateToEdit.id, {
          title: data.title,
          message: data.content,
          priority: data.priority
        })
        setUpdateToEdit(null)
        setSelectedUpdate(null)
      } else {
        await createSecurityUpdate({
          title: data.title,
          message: data.content,
          priority: data.priority
        })
        setIsAdding(false)
      }
      fetchUpdates()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to save update')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSecurityUpdate(updateToDelete.id)
      setUpdateToDelete(null)
      if (selectedUpdate?.id === updateToDelete.id) setSelectedUpdate(null)
      fetchUpdates()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to delete update')
    }
  }

  const handleUnpublish = () => {
    // We mock this since there is no status field on backend to actually update
    const unpublished = { ...selectedUpdate, status: 'Unpublished', lastUpdated: new Date().toISOString() }
    setUpdates(updates.map(u => u.id === selectedUpdate.id ? unpublished : u))
    setSelectedUpdate(unpublished)
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" />
            <div>
              <p className="text-sm font-bold text-red-400">Backend Unreachable</p>
              <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={fetchUpdates} className="px-4 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500 hover:text-white transition-all">Retry</button>
        </div>
      )}

      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Security Updates
            <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              Operations Center
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Publish security announcements, alerts, and policies for all employees.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={fetchUpdates} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 transition-colors">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2">
            <Plus size={16} /> Publish Update
          </button>
        </div>
      </header>

      {/* STATISTICS */}
      <div className="flex overflow-x-auto gap-4 pb-2 custom-scrollbar">
        {stats.map((stat, i) => (
          <div key={i} className="min-w-[180px] flex-1 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-[#0a0f1c]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Search updates..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-[#1e293b]/50 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-full transition-colors"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-slate-400 mr-2 border-r border-white/10 pr-4">
            <Filter size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Filters</span>
          </div>
          
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors">
            <option>All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors">
            <option>All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors">
            <option>All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors">
            <option value="Newest">Sort: Newest</option>
            <option value="Priority">Sort: Priority</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT (Update Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
           <>
            {[1,2,3,4].map(i => <SkeletonLoader key={i} />)}
           </>
        ) : (
          <AnimatePresence>
            {filteredUpdates.map((update) => (
              <motion.div
                key={update.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedUpdate(update)}
                className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl hover:bg-white/5 hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)] transition-all cursor-pointer group flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={update.priority} />
                    <span className="text-[10px] font-mono font-bold text-slate-500">{update.displayId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={update.status} />
                    <button onClick={(e) => { e.stopPropagation(); setUpdateToEdit(update); }} className="p-1.5 text-slate-500 hover:text-white bg-white/5 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-100 group-hover:text-cyan-400 transition-colors mb-2">{update.title}</h3>
                
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Shield size={12} className="text-cyan-500" /> {update.category}
                </p>

                <p className="text-sm text-slate-300 leading-relaxed mb-6 flex-1 line-clamp-2">
                  {update.summary}
                </p>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                  <p className="flex items-center gap-1.5"><User size={14} /> {update.author}</p>
                  <p className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(update.publishDate).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && filteredUpdates.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 bg-white/5 border border-white/5 rounded-2xl border-dashed">
            <BellRing size={48} className="mb-4 opacity-30" />
            <p className="text-sm font-medium">No Security Updates Found</p>
          </div>
        )}
      </div>

      {/* MODALS & DRAWERS */}
      <AnimatePresence>
        {selectedUpdate && (
          <UpdateDrawer 
            update={selectedUpdate} 
            onClose={() => setSelectedUpdate(null)} 
            onEdit={() => { setUpdateToEdit(selectedUpdate); setSelectedUpdate(null); }}
            onDelete={() => { setUpdateToDelete(selectedUpdate); setSelectedUpdate(null); }}
            onUnpublish={handleUnpublish}
          />
        )}
        
        {(isAdding || updateToEdit) && (
          <PublishModal 
            isEditing={!!updateToEdit}
            update={updateToEdit}
            onClose={() => { setIsAdding(false); setUpdateToEdit(null); }}
            onSave={handleSaveUpdate}
          />
        )}

        {updateToDelete && (
          <DeleteConfirmation
            update={updateToDelete}
            onClose={() => setUpdateToDelete(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

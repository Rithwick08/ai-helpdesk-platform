import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Download, Plus, Filter, ChevronDown, 
  Users, Shield, Wrench, ShieldAlert,
  UserCheck, UserMinus, MoreVertical, Edit2, 
  KeyRound, PowerOff, Trash2, X, AlertTriangle, Activity, Mail, Loader2, RefreshCw
} from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser } from '../api/users'

const ROLES = ['Administrator', 'SOC Analyst', 'IT Support', 'Employee']
const DEPARTMENTS = ['IT & Security', 'Security Operations', 'Helpdesk', 'Marketing', 'Finance', 'Engineering', 'HR']

// ── Components ────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => {
  const styles = {
    'Administrator': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'SOC Analyst': 'bg-red-500/10 text-red-400 border-red-500/20',
    'IT Support': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Employee': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[role] || styles['Employee']}`}>
      {role}
    </span>
  )
}

const StatusBadge = ({ status }) => {
  const isActive = status === 'Active'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
      isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
      {status}
    </span>
  )
}

// ── Modals & Drawers ─────────────────────────────────────────────────────────

const DeleteConfirmation = ({ user, onClose, onConfirm, isProcessing }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-[#0f172a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(239,68,68,0.15)]"
    >
      <div className="flex items-center gap-3 mb-4 text-red-400">
        <AlertTriangle size={24} />
        <h3 className="text-lg font-bold text-slate-100">Delete User?</h3>
      </div>
      <p className="text-sm text-slate-300 mb-6 leading-relaxed">
        Are you sure you want to permanently delete <strong className="text-slate-100">{user.name}</strong>? This action cannot be undone and will remove their access to CyberDesk immediately.
      </p>
      <div className="flex justify-end gap-3">
        <button disabled={isProcessing} onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button disabled={isProcessing} onClick={onConfirm} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2">
          {isProcessing && <Loader2 size={14} className="animate-spin" />}
          Yes, Delete User
        </button>
      </div>
    </motion.div>
  </div>
)

const AddEditModal = ({ isEditing, user, onClose, onSave, isProcessing }) => {
  const [formData, setFormData] = useState(user || {
    name: '', email: '', password: '', role: 'Employee', department: 'HR', status: 'Active'
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#0f172a] border border-blue-500/30 rounded-2xl w-full max-w-md shadow-[0_0_40px_rgba(59,130,246,0.1)] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            {isEditing ? <Edit2 size={18} className="text-blue-400" /> : <Plus size={18} className="text-blue-400" />}
            {isEditing ? 'Edit User' : 'Add New User'}
          </h3>
          <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-white disabled:opacity-50"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {!isEditing && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Jane Doe"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="jane.doe@cybershield.ai"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Temporary Password</label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                  disabled={isProcessing}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Role</label>
            <select 
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              disabled={isProcessing}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Department</label>
            <select 
              value={formData.department}
              onChange={e => setFormData({...formData, department: e.target.value})}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              disabled={isProcessing}
            >
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Account Status</label>
            <select 
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              disabled={isProcessing}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-black/20">
          <button disabled={isProcessing} onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button 
            disabled={isProcessing}
            onClick={() => onSave(formData)} 
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const UserDrawer = ({ user, onClose, onEdit, onDelete }) => (
  <div className="fixed inset-0 z-40 flex justify-end">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="relative w-full max-w-md bg-[#0a0f1c] border-l border-white/10 h-full shadow-2xl flex flex-col"
    >
      {/* Drawer Header */}
      <div className="p-6 border-b border-white/10 bg-gradient-to-b from-blue-500/5 to-transparent flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[2px] shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <div className="w-full h-full rounded-[10px] bg-[#0a0f1c] flex items-center justify-center text-lg font-black text-white">
              {user.avatar}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-sm text-slate-400 flex items-center gap-1.5"><Mail size={12}/> {user.email}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg"><X size={18} /></button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        
        {/* Profile Info */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Profile Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Role</p>
              <RoleBadge role={user.role} />
            </div>
            <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Status</p>
              <StatusBadge status={user.status} />
            </div>
            <div className="bg-white/5 border border-white/5 p-3 rounded-xl col-span-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Department</p>
              <p className="text-sm text-slate-200 font-medium">{user.department}</p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Engagement</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-center">
              <p className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Tickets</p>
              <p className="text-xl font-black text-white">{user.assignedTickets}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center">
              <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Incidents</p>
              <p className="text-xl font-black text-white">{user.reportedIncidents}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-center">
              <p className="text-[10px] uppercase tracking-widest text-emerald-400 mb-1">Training</p>
              <p className="text-xl font-black text-white">{user.trainingProgress}</p>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Recent Activity</h3>
          <div className="space-y-4 border-l border-white/10 pl-3 ml-2">
            {user.recentActivity && user.recentActivity.map((act, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <p className="text-sm text-slate-300">{act.action}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{act.time}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Drawer Actions */}
      <div className="p-6 border-t border-white/10 bg-black/20 grid grid-cols-2 gap-3">
        <button onClick={onEdit} className="flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-colors">
          <Edit2 size={14} /> Edit User
        </button>
        <button className="flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-white transition-colors">
          <KeyRound size={14} /> Reset Password
        </button>
        <button className="flex items-center justify-center gap-2 py-2.5 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-xl text-xs font-bold hover:bg-slate-500 hover:text-white transition-colors">
          <PowerOff size={14} /> Deactivate
        </button>
        <button onClick={onDelete} className="flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-colors">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </motion.div>
  </div>
)

// ── Main Page Component ──────────────────────────────────────────────────────

const roleMapToFrontend = {
  admin: 'Administrator',
  soc: 'SOC Analyst',
  it: 'IT Support',
  employee: 'Employee'
}

const roleMapToBackend = {
  'Administrator': 'admin',
  'SOC Analyst': 'soc',
  'IT Support': 'it',
  'Employee': 'employee'
}

const mapUser = (backendUser) => ({
  ...backendUser,
  id: backendUser.id.toString(),
  role: roleMapToFrontend[backendUser.role] || backendUser.role,
  status: backendUser.is_active ? 'Active' : 'Inactive',
  createdAt: backendUser.created_at || new Date().toISOString(),
  avatar: backendUser.name ? backendUser.name.substring(0, 2).toUpperCase() : '??',
  recentActivity: [{ action: 'Account created', time: new Date(backendUser.created_at || Date.now()).toLocaleDateString() }],
  assignedTickets: 0,
  reportedIncidents: 0,
  trainingProgress: '0%'
})

export default function UsersPage() {
  const [users, setUsers] = useState([])
  
  // Data states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All Roles')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [deptFilter, setDeptFilter] = useState('All Departments')
  const [sortOrder, setSortOrder] = useState('Recently Added')

  // UI state
  const [selectedUser, setSelectedUser] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [userToEdit, setUserToEdit] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      setUsers(data.map(mapUser))
    } catch (err) {
      console.error('Failed to fetch users:', err)
      setError('Failed to load users from the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Derived Statistics
  const stats = useMemo(() => [
    { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-400' },
    { label: 'Employees', value: users.filter(u => u.role === 'Employee').length, icon: UserCheck, color: 'text-cyan-400' },
    { label: 'IT Support', value: users.filter(u => u.role === 'IT Support').length, icon: Wrench, color: 'text-amber-400' },
    { label: 'SOC Analysts', value: users.filter(u => u.role === 'SOC Analyst').length, icon: ShieldAlert, color: 'text-red-400' },
    { label: 'Administrators', value: users.filter(u => u.role === 'Administrator').length, icon: Shield, color: 'text-purple-400' },
    { label: 'Active', value: users.filter(u => u.status === 'Active').length, icon: Activity, color: 'text-emerald-400' },
    { label: 'Inactive', value: users.filter(u => u.status === 'Inactive').length, icon: UserMinus, color: 'text-slate-400' },
  ], [users])

  // Filtering Logic
  const filteredUsers = useMemo(() => {
    let result = users

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase()
      result = result.filter(u => u.name.toLowerCase().includes(lowerQ) || u.email.toLowerCase().includes(lowerQ))
    }
    if (roleFilter !== 'All Roles') result = result.filter(u => u.role === roleFilter)
    if (statusFilter !== 'All Status') result = result.filter(u => u.status === statusFilter)
    if (deptFilter !== 'All Departments') result = result.filter(u => u.department === deptFilter)

    if (sortOrder === 'Name') result.sort((a, b) => a.name.localeCompare(b.name))
    if (sortOrder === 'Role') result.sort((a, b) => a.role.localeCompare(b.role))
    
    return result
  }, [users, searchQuery, roleFilter, statusFilter, deptFilter, sortOrder])

  // Handlers
  const handleSaveUser = async (data) => {
    setIsProcessing(true)
    try {
      if (userToEdit) {
        const payload = {
          ...data,
          role: roleMapToBackend[data.role] || data.role,
          is_active: data.status === 'Active'
        }
        await updateUser(userToEdit.id, payload)
        setUserToEdit(null)
        if (selectedUser?.id === userToEdit.id) {
          setSelectedUser(null)
        }
      } else {
        const payload = {
          employee_id: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          name: data.name,
          email: data.email,
          password: data.password,
          department: data.department,
          role: roleMapToBackend[data.role] || data.role,
          is_active: data.status === 'Active'
        }
        await createUser(payload)
        setIsAdding(false)
      }
      await fetchUsers()
    } catch (err) {
      console.error('Save user failed:', err)
      alert(err.message || 'Failed to save user.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    setIsProcessing(true)
    try {
      await deleteUser(userToDelete.id)
      setUserToDelete(null)
      if (selectedUser?.id === userToDelete.id) setSelectedUser(null)
      await fetchUsers()
    } catch (err) {
      console.error('Delete user failed:', err)
      alert(err.message || 'Failed to delete user.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-blue-500/30 text-slate-300">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            User Management
            <span className="text-[10px] font-bold px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(59,130,246,0.2)]">
              Entra ID Inspired
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage employees, administrators, IT support, and SOC analysts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={fetchUsers}
            disabled={loading}
            className="px-4 py-2 bg-[#0a0f1c]/80 border border-white/10 hover:border-white/30 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <Download size={16} /> Export Users
          </button>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2">
            <Plus size={16} /> Add User
          </button>
        </div>
      </header>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
          <ShieldAlert className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-400">Connection Error</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
          <button onClick={fetchUsers} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* STATISTICS */}
      <div className="flex overflow-x-auto gap-4 pb-2 custom-scrollbar">
        {stats.map((stat, i) => (
          <div key={i} className="min-w-[160px] flex-1 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
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
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-[#1e293b]/50 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-full transition-colors"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-slate-400 mr-2 border-r border-white/10 pr-4">
            <Filter size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Filters</span>
          </div>
          
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 transition-colors">
            <option>All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 transition-colors">
            <option>All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 transition-colors">
            <option>All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="bg-[#1e293b]/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-blue-500 transition-colors">
            <option value="Recently Added">Sort: Recent</option>
            <option value="Name">Sort: Name</option>
            <option value="Role">Sort: Role</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT (User Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
           Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col gap-4 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 shadow-inner"></div>
                  <div className="space-y-2">
                    <div className="w-24 h-4 bg-white/10 rounded"></div>
                    <div className="w-32 h-3 bg-white/5 rounded"></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-3 flex-1">
                <div className="w-16 h-4 bg-white/5 rounded"></div>
                <div className="w-16 h-4 bg-white/5 rounded"></div>
                <div className="col-span-2 w-24 h-4 bg-white/5 rounded mt-2"></div>
              </div>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="w-12 h-3 bg-white/5 rounded"></div>
                <div className="w-20 h-3 bg-white/5 rounded"></div>
              </div>
            </div>
           ))
        ) : (
          <AnimatePresence>
            {filteredUsers.map((user, idx) => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedUser(user)}
                className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-xl hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer group flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                      {user.avatar}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">{user.name}</h3>
                      <p className="text-[11px] text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setUserToEdit(user); }} className="p-1.5 text-slate-500 hover:text-white bg-white/5 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                    <MoreVertical size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-y-3 mb-4 flex-1">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Role</p>
                    <RoleBadge role={user.role} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Status</p>
                    <StatusBadge status={user.status} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Department</p>
                    <p className="text-xs text-slate-300 font-medium">{user.department}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 font-mono">ID: {user.employee_id}</p>
                  <p className="text-[10px] text-slate-500">Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 bg-white/5 border border-white/5 rounded-2xl border-dashed">
            <Users size={48} className="mb-4 opacity-50" />
            <p className="text-sm">No users found.</p>
          </div>
        )}
      </div>

      {/* MODALS & DRAWERS */}
      <AnimatePresence>
        {selectedUser && (
          <UserDrawer 
            user={selectedUser} 
            onClose={() => setSelectedUser(null)} 
            onEdit={() => setUserToEdit(selectedUser)}
            onDelete={() => setUserToDelete(selectedUser)}
          />
        )}
        
        {(isAdding || userToEdit) && (
          <AddEditModal 
            isEditing={!!userToEdit}
            user={userToEdit}
            onClose={() => { setIsAdding(false); setUserToEdit(null); }}
            onSave={handleSaveUser}
            isProcessing={isProcessing}
          />
        )}

        {userToDelete && (
          <DeleteConfirmation
            user={userToDelete}
            onClose={() => setUserToDelete(null)}
            onConfirm={handleDelete}
            isProcessing={isProcessing}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, Plus, Filter, ShieldAlert,
  ChevronDown, ChevronUp, Bot, User, Clock, AlertTriangle,
  FileSearch, Lock, CheckCircle2, AlertCircle, ArrowUpRight, BarChart2
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_INCIDENTS = [
  {
    id: 'INC-00142',
    title: 'Multiple Failed Login Attempts (Brute Force)',
    severity: 'Critical',
    status: 'Open',
    category: 'Authentication',
    confidence: 94,
    createdAt: '10 mins ago',
    analyst: 'Unassigned',
    description: 'Detected 500+ failed login attempts from IP 192.168.45.2 targeting the admin portal within a 5-minute window.',
    timeline: [
      { time: '10:15 AM', event: 'Initial failed login spike detected' },
      { time: '10:17 AM', event: 'Threshold exceeded. Alert generated' },
      { time: '10:20 AM', event: 'AI marked as High Confidence Brute Force' }
    ],
    evidence: ['auth_logs.csv', 'ip_trace.json'],
    containment: 'IP 192.168.45.2 has been temporarily blocked by firewall.',
    aiRecommendations: [
      'Enforce MFA for all admin accounts immediately.',
      'Block the offending IP subnet at the edge router.'
    ]
  },
  {
    id: 'INC-00141',
    title: 'Suspicious Powershell Execution',
    severity: 'High',
    status: 'In Progress',
    category: 'Malware',
    confidence: 88,
    createdAt: '1 hour ago',
    analyst: 'Jane Doe',
    description: 'Endpoint DESKTOP-X92 running encoded powershell script fetching payload from known malicious domain.',
    timeline: [
      { time: '09:05 AM', event: 'Process execution flagged by EDR' },
      { time: '09:15 AM', event: 'Analyst Jane Doe assigned' },
      { time: '09:30 AM', event: 'Endpoint isolated from network' }
    ],
    evidence: ['process_tree.png', 'encoded_script.txt'],
    containment: 'Endpoint isolated. Network connections severed.',
    aiRecommendations: [
      'Initiate full memory dump of DESKTOP-X92.',
      'Scan network for lateral movement indicators.'
    ]
  },
  {
    id: 'INC-00140',
    title: 'Data Exfiltration via DNS',
    severity: 'Critical',
    status: 'Open',
    category: 'Exfiltration',
    confidence: 98,
    createdAt: '2 hours ago',
    analyst: 'Unassigned',
    description: 'Anomalous volume of DNS TXT records requested from internal server to external unknown domain.',
    timeline: [
      { time: '08:00 AM', event: 'Traffic anomaly detected' },
      { time: '08:10 AM', event: 'AI confirmed DNS tunneling signature' }
    ],
    evidence: ['pcap_capture.pcap'],
    containment: 'None applied yet.',
    aiRecommendations: [
      'Null-route the destination domain.',
      'Investigate source server for malware infection.'
    ]
  },
  {
    id: 'INC-00139',
    title: 'Phishing Email Campaign Detected',
    severity: 'Medium',
    status: 'Resolved',
    category: 'Social Engineering',
    confidence: 85,
    createdAt: '1 day ago',
    analyst: 'John Smith',
    description: 'Multiple employees reported a phishing email pretending to be HR payroll update.',
    timeline: [
      { time: 'Yesterday 02:00 PM', event: 'First user report received' },
      { time: 'Yesterday 02:30 PM', event: 'Sender domain added to blocklist' },
      { time: 'Yesterday 03:00 PM', event: 'Emails purged from inboxes' }
    ],
    evidence: ['email_headers.txt', 'malicious_link.url'],
    containment: 'Sender blocked. Emails purged.',
    aiRecommendations: [
      'Assign phishing awareness training to affected users.'
    ]
  }
]

const SEVERITY_CHART = [
  { name: 'Critical', value: 12, color: '#ef4444' },
  { name: 'High', value: 24, color: '#f59e0b' },
  { name: 'Medium', value: 45, color: '#3b82f6' },
  { name: 'Low', value: 60, color: '#10b981' },
]

const CATEGORY_CHART = [
  { name: 'Auth', value: 35, fill: '#8b5cf6' },
  { name: 'Malware', value: 28, fill: '#ef4444' },
  { name: 'Phishing', value: 42, fill: '#3b82f6' },
  { name: 'Data', value: 15, fill: '#f59e0b' },
]

const MONTHLY_CHART = [
  { name: 'Jan', incidents: 45 },
  { name: 'Feb', incidents: 52 },
  { name: 'Mar', incidents: 38 },
  { name: 'Apr', incidents: 65 },
  { name: 'May', incidents: 48 },
  { name: 'Jun', incidents: 70 },
]

// ── Components ────────────────────────────────────────────────────────────────

const Badge = ({ children, colorClass }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
    {children}
  </span>
)

const SeverityBadge = ({ level }) => {
  const styles = {
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    High: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
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

const IncidentCard = ({ incident, isExpanded, onToggle }) => {
  return (
    <motion.div 
      layout
      className={`bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-colors ${isExpanded ? 'border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'hover:border-white/20 hover:bg-[#0a0f1c]'}`}
    >
      {/* Header / Collapsed State */}
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono font-bold text-cyan-400">{incident.id}</span>
            <SeverityBadge level={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <h3 className="text-base font-bold text-slate-100">{incident.title}</h3>
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
          <div className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expanded State */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-black/20"
          >
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Col: Details & AI */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FileSearch size={14} /> Description
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                    {incident.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Lock size={14} /> Containment
                    </h4>
                    <p className="text-sm text-emerald-300/80">{incident.containment}</p>
                  </div>
                  
                  <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Bot size={14} /> AI Recommendations
                    </h4>
                    <ul className="text-sm text-cyan-300/80 list-disc list-inside space-y-1">
                      {incident.aiRecommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <CheckCircle2 size={16} /> Resolve Incident
                  </button>
                  <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <ArrowUpRight size={16} /> Escalate
                  </button>
                  <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <User size={16} /> Assign to me
                  </button>
                </div>
              </div>

              {/* Right Col: Timeline & Evidence */}
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

export default function IncidentPage() {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Security Incidents
            <span className="text-[10px] font-bold px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              Live Threat Ops
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Real-time incident management & AI triage</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search incidents..." 
              className="pl-9 pr-4 py-2 bg-[#0a0f1c]/80 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-full sm:w-64"
            />
          </div>
          <button className="p-2 rounded-lg bg-[#0a0f1c]/80 border border-white/10 hover:border-white/30 text-slate-300 transition-colors">
            <RefreshCw size={18} />
          </button>
          <button className="px-4 py-2 bg-cyan-500 text-black font-bold text-sm rounded-lg hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2">
            <Plus size={18} /> Create Incident
          </button>
        </div>
      </header>

      {/* ── TOP CHARTS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-64">
        
        <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle size={14} /> Incident Severity
          </h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={SEVERITY_CHART} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                  {SEVERITY_CHART.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldAlert size={14} /> Attack Categories
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CATEGORY_CHART} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {CATEGORY_CHART.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
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
              <AreaChart data={MONTHLY_CHART} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
        {['Severity', 'Status', 'Category', 'Assigned Analyst', 'Date Range'].map(filter => (
          <button key={filter} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10 hover:border-white/20 flex items-center gap-2 transition-colors">
            {filter} <ChevronDown size={12} className="text-slate-500" />
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT & RIGHT PANEL ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Col: Incidents List */}
        <div className="xl:col-span-3 space-y-4">
          <AnimatePresence>
            {MOCK_INCIDENTS.map((incident) => (
              <IncidentCard 
                key={incident.id} 
                incident={incident} 
                isExpanded={expandedId === incident.id}
                onToggle={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right Col: SOC Summary */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl sticky top-8">
            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-widest">
              <Activity size={16} className="text-cyan-400" /> Live SOC Summary
            </h2>
            
            <div className="space-y-6">
              
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Active Incidents by Severity</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
                    <span className="text-xs font-semibold text-red-400">Critical</span>
                    <span className="text-sm font-bold text-white">12</span>
                  </div>
                  <div className="flex justify-between items-center bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
                    <span className="text-xs font-semibold text-amber-400">High</span>
                    <span className="text-sm font-bold text-white">24</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 p-2.5 rounded-lg">
                    <span className="text-xs font-semibold text-blue-400">Medium</span>
                    <span className="text-sm font-bold text-white">45</span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg">
                    <span className="text-xs font-semibold text-emerald-400">Low</span>
                    <span className="text-sm font-bold text-white">60</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Open</p>
                  <p className="text-2xl font-black text-white">141</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Resolved Today</p>
                  <p className="text-2xl font-black text-emerald-400">28</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Avg Resolution Time</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-white">4h 12m</p>
                  <span className="text-xs font-medium text-emerald-400">-15% vs MT</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  )
}

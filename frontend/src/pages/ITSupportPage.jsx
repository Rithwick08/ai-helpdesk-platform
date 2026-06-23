import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, Plus, Filter, ChevronDown, ChevronUp,
  Ticket as TicketIcon, Clock, User, AlertCircle, CheckCircle2,
  Cpu, HardDrive, Wifi, MonitorSmartphone, ShieldAlert,
  ArrowRightCircle, MailX
} from 'lucide-react'
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TICKETS = [
  {
    id: 'TKT-08942',
    employee: 'Sarah Jenkins',
    title: 'VPN Connection Dropping Every 10 Mins',
    priority: 'High',
    status: 'Open',
    category: 'Network',
    createdAt: '15 mins ago',
    engineer: 'Unassigned',
    description: 'Since the OS update yesterday, my Cisco AnyConnect VPN disconnects exactly every 10 minutes. I am working remotely and this is completely blocking my work.',
    diagnosis: 'Detected DART logs indicating MTU mismatch after KB5034441 update on Windows 11.',
    recommendedFix: 'Adjust VPN adapter MTU size to 1350 via Powershell or push Intune network remediation script.',
    steps: [
      'Open Powershell as Administrator',
      'Run: netsh interface ipv4 set subinterface "Cisco AnyConnect" mtu=1350 store=persistent',
      'Restart the VPN service'
    ],
    history: [
      { time: '09:15 AM', action: 'Ticket Created by User' },
      { time: '09:16 AM', action: 'AI Diagnosis Completed' }
    ]
  },
  {
    id: 'TKT-08941',
    employee: 'Michael Chen',
    title: 'Need access to Salesforce Prod Data',
    priority: 'Medium',
    status: 'Pending',
    category: 'Access',
    createdAt: '1 hour ago',
    engineer: 'Alex Mercer',
    description: 'I moved to the Enterprise Sales team this week but I am still seeing my old SMB accounts in Salesforce. I need my profile updated.',
    diagnosis: 'User role in Azure AD (Sales_SMB) does not match requested access (Sales_Enterprise).',
    recommendedFix: 'Approve Azure AD group change request and trigger Salesforce provisioning sync.',
    steps: [
      'Verify transfer in Workday',
      'Move user from Azure AD group "Sales_SMB" to "Sales_Enterprise"',
      'Force Okta/Salesforce sync cycle'
    ],
    history: [
      { time: '08:30 AM', action: 'Ticket Created by User' },
      { time: '08:45 AM', action: 'Assigned to Alex Mercer' },
      { time: '09:00 AM', action: 'Pending Manager Approval' }
    ]
  },
  {
    id: 'TKT-08940',
    employee: 'David Miller',
    title: 'Blue Screen of Death on Boot',
    priority: 'Critical',
    status: 'In Progress',
    category: 'Hardware',
    createdAt: '2 hours ago',
    engineer: 'Sarah Jenkins',
    description: 'Laptop crashed during a Zoom call. Now it just shows a blue screen with error CRITICAL_PROCESS_DIED every time I turn it on.',
    diagnosis: 'Intune telemetry shows recent CrowdStrike Falcon sensor update failed to initialize.',
    recommendedFix: 'Boot to Safe Mode, rename CrowdStrike sys file, and reboot.',
    steps: [
      'Guide user to boot into Safe Mode with Command Prompt',
      'Navigate to C:\\Windows\\System32\\drivers\\CrowdStrike',
      'Rename C-00000291*.sys to *.sys.bak',
      'Reboot normally'
    ],
    history: [
      { time: '07:30 AM', action: 'Ticket Created via Phone Call' },
      { time: '07:35 AM', action: 'Assigned to Sarah Jenkins' },
      { time: '08:15 AM', action: 'User contacted, walking through Safe Mode' }
    ]
  },
  {
    id: 'TKT-08939',
    employee: 'Emma Watson',
    title: 'Outlook not syncing emails',
    priority: 'Low',
    status: 'Resolved',
    category: 'Software',
    createdAt: '1 day ago',
    engineer: 'Alex Mercer',
    description: 'My Outlook desktop app says "Disconnected" at the bottom. Webmail works fine.',
    diagnosis: 'Cached Exchange Mode synchronization error (OST file corruption).',
    recommendedFix: 'Rebuild the OST file or create a new Outlook profile.',
    steps: [
      'Close Outlook',
      'Navigate to %localappdata%\\Microsoft\\Outlook',
      'Rename the .ost file to .ost.old',
      'Restart Outlook and wait for sync'
    ],
    history: [
      { time: 'Yesterday 02:00 PM', action: 'Ticket Created' },
      { time: 'Yesterday 02:10 PM', action: 'AI suggested OST rebuild script' },
      { time: 'Yesterday 02:30 PM', action: 'User ran self-service fix' },
      { time: 'Yesterday 03:00 PM', action: 'Ticket Closed (Auto-Resolved)' }
    ]
  }
]

const CATEGORY_CHART = [
  { name: 'Hardware', value: 15, color: '#6366f1' }, // Indigo
  { name: 'Software', value: 35, color: '#3b82f6' }, // Blue
  { name: 'Access', value: 40, color: '#0ea5e9' },   // Sky
  { name: 'Network', value: 10, color: '#2dd4bf' },  // Teal
]

const RESOLUTION_CHART = [
  { time: '8AM', avg: 1.2 },
  { time: '10AM', avg: 1.8 },
  { time: '12PM', avg: 2.5 },
  { time: '2PM', avg: 1.5 },
  { time: '4PM', avg: 1.1 },
  { time: '6PM', avg: 0.8 },
]

// ── Components ────────────────────────────────────────────────────────────────

const PriorityBadge = ({ level }) => {
  const styles = {
    Critical: 'bg-[#ff3366]/10 text-[#ff3366] border-[#ff3366]/20',
    High: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[level] || styles.Medium}`}>
      {level}
    </span>
  )
}

const StatusBadge = ({ status }) => {
  const styles = {
    'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'In Progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Resolved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles.Open}`}>
      {status}
    </span>
  )
}

const CategoryIcon = ({ category }) => {
  const icons = {
    Hardware: <HardDrive size={14} />,
    Software: <MonitorSmartphone size={14} />,
    Network: <Wifi size={14} />,
    Access: <ShieldAlert size={14} />
  }
  return icons[category] || <Cpu size={14} />
}

const TicketCard = ({ ticket, isExpanded, onToggle }) => {
  return (
    <motion.div 
      layout
      className={`bg-[#111827]/80 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'hover:border-white/10 hover:bg-[#1f2937]/50'}`}
    >
      {/* Closed State Header */}
      <div 
        className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono font-bold text-blue-400">{ticket.id}</span>
            <PriorityBadge level={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <h3 className="text-base font-bold text-slate-100">{ticket.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
          <div className="hidden lg:block">
            <p className="font-semibold text-slate-300 mb-0.5 flex items-center gap-1.5">
              <CategoryIcon category={ticket.category} /> {ticket.category}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Category</p>
          </div>
          <div className="hidden sm:block">
            <p className="font-semibold text-slate-300 mb-0.5 flex items-center gap-1.5">
              <User size={14} /> {ticket.employee}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Employee</p>
          </div>
          <div className="hidden xl:block">
            <p className="font-semibold text-slate-300 mb-0.5 flex items-center gap-1.5">
              <Clock size={14} /> {ticket.createdAt}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Created</p>
          </div>
          <div className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-[#0b0f19]"
          >
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Details & Fix */}
              <div className="lg:col-span-2 space-y-6">
                
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Problem Description</h4>
                  <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                    {ticket.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                    <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Cpu size={14} /> AI Diagnosis
                    </h4>
                    <p className="text-sm text-indigo-200/80 leading-relaxed">{ticket.diagnosis}</p>
                  </div>
                  
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                    <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <CheckCircle2 size={14} /> Recommended Fix
                    </h4>
                    <p className="text-sm text-emerald-200/80 leading-relaxed">{ticket.recommendedFix}</p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Suggested Resolution Steps</h4>
                  <ol className="space-y-2">
                    {ticket.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                    <User size={16} /> Assign to me
                  </button>
                  <button className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <CheckCircle2 size={16} /> Resolve Ticket
                  </button>
                  <button className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <ArrowRightCircle size={16} /> Escalate
                  </button>
                  <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <MailX size={16} /> Close Ticket
                  </button>
                </div>

              </div>

              {/* Right Column: History & Meta */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Ticket History</h4>
                  <div className="relative pl-3 space-y-5 before:absolute before:inset-0 before:ml-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
                    {ticket.history.map((item, i) => (
                      <div key={i} className="relative flex items-start gap-3">
                        <div className="absolute left-[-15px] w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)] mt-1.5" />
                        <div className="ml-2">
                          <p className="text-[10px] font-mono text-blue-400 mb-0.5">{item.time}</p>
                          <p className="text-xs text-slate-300 leading-snug">{item.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Assignment Info</h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Current Assignee</span>
                    <span className="font-semibold text-slate-200">{ticket.engineer}</span>
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

export default function ITSupportPage() {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#09090b] font-sans text-slate-300 selection:bg-blue-500/30">
      
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            IT Service Desk
            <span className="text-[10px] font-bold px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(59,130,246,0.2)]">
              Microsoft Intune Integration
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage employee IT requests & AI diagnostics</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-full sm:w-64 transition-colors"
            />
          </div>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 transition-colors">
            <RefreshCw size={18} />
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2">
            <Plus size={18} /> New Ticket
          </button>
        </div>
      </header>

      {/* ── STATISTICS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Open Tickets', value: '42', color: 'text-blue-400' },
          { label: 'Resolved Today', value: '18', color: 'text-emerald-400' },
          { label: 'Avg Resolution Time', value: '1.4h', color: 'text-slate-100' },
          { label: 'Pending Escalations', value: '5', color: 'text-amber-400' },
          { label: 'Critical Tickets', value: '3', color: 'text-[#ff3366]' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#111827]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-lg hover:bg-white/5 transition-colors">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-[#111827]/60 backdrop-blur-md border border-white/5 rounded-xl">
        <div className="flex items-center gap-2 text-slate-400 mr-2">
          <Filter size={16} />
          <span className="text-[11px] font-bold uppercase tracking-widest">Filters</span>
        </div>
        {['Status', 'Priority', 'Category', 'Assigned Engineer'].map(filter => (
          <button key={filter} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/10 hover:border-white/20 flex items-center gap-2 transition-colors">
            {filter} <ChevronDown size={12} className="text-slate-500" />
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT & RIGHT PANEL ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Column: Tickets */}
        <div className="xl:col-span-3 space-y-4">
          <AnimatePresence>
            {MOCK_TICKETS.map((ticket) => (
              <TicketCard 
                key={ticket.id} 
                ticket={ticket} 
                isExpanded={expandedId === ticket.id}
                onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right Column: Operations Summary & Charts */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#111827]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl sticky top-8 space-y-8">
            
            <div>
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TicketIcon size={14} className="text-blue-400" /> IT Operations Summary
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className="text-xs font-semibold text-slate-300">Unassigned Tickets</span>
                  <span className="text-sm font-bold text-white bg-white/10 px-2 py-0.5 rounded">12</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className="text-xs font-semibold text-slate-300">Pending Assignments</span>
                  <span className="text-sm font-bold text-white bg-white/10 px-2 py-0.5 rounded">4</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className="text-xs font-semibold text-slate-300">Escalations</span>
                  <span className="text-sm font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">Avg Response Time</span>
                  <span className="text-sm font-bold text-emerald-400">12m</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <PieChart size={14} /> Tickets by Category
              </h3>
              <div className="h-40 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={CATEGORY_CHART} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                      {CATEGORY_CHART.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CATEGORY_CHART.map(c => (
                  <div key={c.name} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name} ({c.value}%)
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={14} /> Resolution Trend (hrs)
              </h3>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={RESOLUTION_CHART} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRes)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}

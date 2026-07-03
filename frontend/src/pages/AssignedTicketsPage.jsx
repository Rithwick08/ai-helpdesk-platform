import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket, CheckCircle2, AlertCircle, Clock, ChevronRight, X,
  User, Bot, ShieldAlert, Check, PlayCircle, Info, Calendar
} from 'lucide-react'

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TICKETS = [
  {
    id: 'TKT-8021',
    employee: 'Sarah Jenkins',
    department: 'Finance',
    title: 'Cannot access QuickBooks after OS update',
    priority: 'High',
    status: 'In Progress',
    category: 'Software',
    createdDate: '2 hours ago',
    aiDiagnosis: 'The recent Windows 11 update (KB5031455) is known to reset local firewall rules, which blocks the specific ports QuickBooks uses for local network access.',
    resolutionSteps: [
      'Open Windows Defender Firewall with Advanced Security.',
      'Navigate to Inbound Rules and create a new Port rule.',
      'Allow TCP ports 8019, 56728, 55378-55382.',
      'Restart the QuickBooks Database Server Manager service.'
    ],
    history: [
      { time: '2 hrs ago', text: 'Ticket created via Email.' },
      { time: '1 hr ago', text: 'AI Diagnosis attached.' },
      { time: '30 mins ago', text: 'Status changed to In Progress by You.' }
    ]
  },
  {
    id: 'TKT-8019',
    employee: 'Marcus Chen',
    department: 'Engineering',
    title: 'Docker daemon failing to start on Mac M2',
    priority: 'Medium',
    status: 'Open',
    category: 'Development',
    createdDate: '4 hours ago',
    aiDiagnosis: 'Docker Desktop requires Rosetta 2 for x86/amd64 emulation, which may have been uninstalled or corrupted during a recent macOS Sonoma update.',
    resolutionSteps: [
      'Open Terminal.',
      'Run: softwareupdate --install-rosetta --agree-to-license',
      'Open Docker Desktop settings, go to Features in development.',
      'Enable "Use Rosetta for x86/amd64 emulation on Apple Silicon".',
      'Restart Docker Desktop.'
    ],
    history: [
      { time: '4 hrs ago', text: 'Ticket created via Slack.' },
      { time: '3 hrs ago', text: 'Assigned to You.' }
    ]
  },
  {
    id: 'TKT-8015',
    employee: 'Elena Rodriguez',
    department: 'HR',
    title: 'Printer showing offline in floor 3',
    priority: 'Low',
    status: 'Pending Response',
    category: 'Hardware',
    createdDate: '1 day ago',
    aiDiagnosis: 'The printer (IP 10.0.3.45) is not responding to ICMP pings. Likely a physical network disconnection or the device is powered off.',
    resolutionSteps: [
      'Verify physical power to the printer on Floor 3.',
      'Check if the ethernet cable is securely connected to the wall port.',
      'If powered on, ping 10.0.3.45 from a local machine.',
      'If ping fails, re-patch the port in the local IDF.'
    ],
    history: [
      { time: '1 day ago', text: 'Ticket created via Portal.' },
      { time: '20 hrs ago', text: 'You requested the user to check the power cable.' }
    ]
  },
  {
    id: 'TKT-8010',
    employee: 'James Wilson',
    department: 'Sales',
    title: 'Account locked out repeatedly',
    priority: 'Critical',
    status: 'Open',
    category: 'Access',
    createdDate: '15 mins ago',
    aiDiagnosis: 'Azure AD logs show repeated failed logins from a legacy POP3 client authenticating via an old mobile device (iOS 14), causing the AD lockout policy to trigger.',
    resolutionSteps: [
      'Unlock the account in Active Directory.',
      'Instruct the user to remove the Exchange account from their old iPad.',
      'Force sign-out of all active Microsoft 365 sessions.',
      'Help the user re-authenticate using the modern Outlook app.'
    ],
    history: [
      { time: '15 mins ago', text: 'Automated alert from Azure AD.' },
      { time: '10 mins ago', text: 'Assigned to You.' }
    ]
  }
]

// ── Components ────────────────────────────────────────────────────────────────

const PriorityBadge = ({ priority }) => {
  const styles = {
    'Critical': 'bg-red-500/10 text-red-400 border-red-500/20',
    'High': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Medium': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Low': 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[priority]}`}>
      {priority}
    </span>
  )
}

const StatusBadge = ({ status }) => {
  const styles = {
    'Open': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'In Progress': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'Pending Response': 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  }
  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 ${styles[status]}`}>
      {status === 'Open' && <AlertCircle size={12} />}
      {status === 'In Progress' && <Clock size={12} />}
      {status === 'Pending Response' && <Info size={12} />}
      {status}
    </span>
  )
}

const TicketDrawer = ({ ticket, onClose }) => {
  if (!ticket) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-2xl bg-[#0a0f1c] border-l border-white/10 h-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 bg-[#0d1424] relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white bg-white/5 rounded-lg transition-colors">
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/10">{ticket.id}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          
          <h2 className="text-2xl font-black text-white leading-tight mb-4 pr-12">{ticket.title}</h2>
          
          <div className="flex items-center gap-6 text-sm text-slate-400 border-t border-white/5 pt-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                {ticket.employee.charAt(0)}
              </div>
              <span className="text-slate-300 font-medium">{ticket.employee}</span>
              <span className="text-xs text-slate-500">({ticket.department})</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar size={14} className="text-slate-500" />
              {ticket.createdDate}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          
          {/* AI Diagnosis */}
          <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
            <h3 className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Bot size={14} /> AI Root Cause Diagnosis
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {ticket.aiDiagnosis}
            </p>
          </div>

          {/* Resolution Steps */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <PlayCircle size={14} /> Recommended Resolution Steps
            </h3>
            <div className="space-y-3">
              {ticket.resolutionSteps.map((step, idx) => (
                <div key={idx} className="flex gap-3 items-start bg-white/5 border border-white/5 p-3 rounded-lg group hover:border-white/10 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center font-mono text-[10px] mt-0.5 shrink-0 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                    {idx + 1}
                  </div>
                  <p className="text-sm text-slate-300 pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket History */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock size={14} /> Activity History
            </h3>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-0 md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-700 before:to-transparent">
              {ticket.history.map((hist, idx) => (
                <div key={idx} className="relative flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0a0f1c] bg-slate-600 z-10 shrink-0" />
                  <div className="bg-white/5 rounded border border-white/5 p-3 flex-1 flex justify-between items-center text-sm">
                    <span className="text-slate-300">{hist.text}</span>
                    <span className="text-xs text-slate-500 font-mono">{hist.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#0d1424] flex items-center justify-end gap-3">
          <button className="px-4 py-2 bg-transparent text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white rounded-lg text-sm font-bold transition-all uppercase tracking-wider">
            Escalate
          </button>
          <button className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-bold transition-all uppercase tracking-wider flex items-center gap-2">
            <Check size={16} /> Resolve
          </button>
          <button className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-lg text-sm font-bold transition-all uppercase tracking-wider">
            Close Ticket
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function AssignedTicketsPage() {
  const [selectedTicket, setSelectedTicket] = useState(null)

  return (
    <div className="min-h-screen p-6 lg:p-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── HEADER ── */}
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          My Assigned Tickets
          <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full tracking-widest uppercase">
            {MOCK_TICKETS.length} Active
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-2">Manage and resolve tickets currently assigned to your queue.</p>
      </header>

      {/* ── TICKET LIST ── */}
      <div className="space-y-3">
        {MOCK_TICKETS.map(ticket => (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedTicket(ticket)}
            className="bg-[#0A0F1C] border border-white/5 rounded-xl p-4 hover:bg-white/5 hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)] transition-all cursor-pointer group flex flex-col md:flex-row md:items-center gap-4"
          >
            {/* Status & Priority */}
            <div className="flex items-center gap-3 md:w-48 shrink-0">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>

            {/* Core Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-slate-500">{ticket.id}</span>
                <span className="text-[10px] text-slate-600 px-1.5 py-0.5 bg-white/5 rounded">{ticket.category}</span>
              </div>
              <h3 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                {ticket.title}
              </h3>
            </div>

            {/* User & Time */}
            <div className="flex items-center gap-6 text-sm text-slate-400 shrink-0">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-slate-300 text-xs font-medium">{ticket.employee}</span>
                <span className="text-[10px]">{ticket.department}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <Clock size={12} className="text-slate-500" />
                {ticket.createdDate}
              </div>
              <ChevronRight size={20} className="text-slate-600 group-hover:text-cyan-400 transition-colors hidden md:block" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {selectedTicket && (
          <TicketDrawer 
            ticket={selectedTicket} 
            onClose={() => setSelectedTicket(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  )
}

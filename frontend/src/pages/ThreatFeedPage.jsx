import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, Activity, RefreshCw, AlertTriangle, Bug, Globe,
  Crosshair, Server, Database, Shield, X, ChevronRight, CheckCircle2,
  List, Terminal, Lock, Cpu
} from 'lucide-react'

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_STATS = [
  { label: 'Active Threats', value: '42', color: 'text-red-500', bg: 'bg-red-500/10' },
  { label: 'Critical Alerts', value: '8', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { label: 'New CVEs', value: '156', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: 'Malicious IPs', value: '8,432', color: 'text-cyan-500', bg: 'bg-cyan-500/10' }
]

const MOCK_THREATS = [
  {
    id: 'TRT-9921',
    name: 'Scattered Spider Ransomware Campaign',
    severity: 'Critical',
    description: 'A highly sophisticated ransomware campaign utilizing advanced social engineering against IT help desks to gain initial access, followed by rapid lateral movement using Living off the Land (LotL) techniques.',
    affectedSystems: ['Windows Servers', 'Azure AD', 'Okta'],
    publishedTime: '10 mins ago',
    iocCount: 45,
    mitre: [
      { id: 'T1566', name: 'Phishing' },
      { id: 'T1078', name: 'Valid Accounts' },
      { id: 'T1486', name: 'Data Encrypted for Impact' }
    ],
    recommendedActions: [
      'Force password resets for all highly privileged accounts.',
      'Temporarily disable SMS-based MFA for helpdesk verifications.',
      'Block known C2 IP addresses at the perimeter firewall.'
    ],
    iocs: [
      { type: 'IP', value: '185.15.22.109' },
      { type: 'Domain', value: 'auth-sso-verify.net' },
      { type: 'SHA256', value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
    ],
    relatedIncidents: ['INC-1042', 'INC-1045']
  },
  {
    id: 'TRT-9920',
    name: 'CVE-2026-0042: Exchange Server RCE',
    severity: 'Critical',
    description: 'Zero-day vulnerability in Microsoft Exchange Server allowing unauthenticated attackers to execute arbitrary code with SYSTEM privileges via specially crafted HTTP requests.',
    affectedSystems: ['Exchange Server 2019', 'Exchange Server 2016'],
    publishedTime: '1 hr ago',
    iocCount: 12,
    mitre: [
      { id: 'T1190', name: 'Exploit Public-Facing Application' },
      { id: 'T1505.003', name: 'Web Shell' }
    ],
    recommendedActions: [
      'Apply the out-of-band Microsoft patch immediately.',
      'Run the Exchange Server Health Checker script.',
      'Scan the inetpub directory for newly created .aspx files.'
    ],
    iocs: [
      { type: 'URI', value: '/autodiscover/autodiscover.json?@evil.com/...' },
      { type: 'IP', value: '45.76.12.99' }
    ],
    relatedIncidents: []
  },
  {
    id: 'TRT-9919',
    name: 'Credential Harvester targeting Microsoft 365',
    severity: 'High',
    description: 'A massive phishing wave delivering HTML attachments that locally render realistic Microsoft login pages, bypassing many traditional email security gateways.',
    affectedSystems: ['Corporate Email', 'Endpoints'],
    publishedTime: '3 hrs ago',
    iocCount: 88,
    mitre: [
      { id: 'T1566.002', name: 'Spearphishing Link' },
      { id: 'T1114', name: 'Email Collection' }
    ],
    recommendedActions: [
      'Block execution of HTML attachments in the email gateway.',
      'Identify users who opened the attachment and reset credentials.',
      'Hunt for abnormal sign-in locations in Azure AD logs.'
    ],
    iocs: [
      { type: 'Domain', value: 'login-microsoft-secure.com' },
      { type: 'IP', value: '192.0.2.14' }
    ],
    relatedIncidents: ['INC-1038']
  },
  {
    id: 'TRT-9918',
    name: 'Suspicious PowerShell Execution',
    severity: 'Medium',
    description: 'Endpoint Detection identified base64 encoded PowerShell commands attempting to bypass AMSI (Anti-Malware Scan Interface) on multiple workstations in the Finance VLAN.',
    affectedSystems: ['Windows 11 Workstations'],
    publishedTime: '5 hrs ago',
    iocCount: 3,
    mitre: [
      { id: 'T1059.001', name: 'PowerShell' },
      { id: 'T1562.001', name: 'Disable or Modify Tools' }
    ],
    recommendedActions: [
      'Isolate affected workstations (FIN-WKST-01, FIN-WKST-04).',
      'Review decoded PowerShell payload for C2 communication.',
      'Re-enable Script Block Logging if disabled.'
    ],
    iocs: [
      { type: 'Command', value: 'powershell.exe -nop -w hidden -e JABzAD0ATgBlAHcALQBPAGIAagBlAGMAd...' }
    ],
    relatedIncidents: ['INC-1035']
  }
]

const TOP_ATTACKS = [
  { name: 'Phishing / Credential Theft', percentage: 45 },
  { name: 'Ransomware / Extortion', percentage: 22 },
  { name: 'Vulnerability Exploitation', percentage: 18 },
  { name: 'Insider Threat', percentage: 10 },
  { name: 'DDoS Attacks', percentage: 5 }
]

const RECENT_ACTIVITY = [
  { time: '10:42 AM', action: 'Firewall blocked 145 connections to known C2 node.' },
  { time: '10:38 AM', action: 'SOC Analyst escalated INC-1045 to Tier 3.' },
  { time: '10:15 AM', action: 'CrowdStrike isolated endpoint FIN-WKST-04.' },
  { time: '09:55 AM', action: 'New threat intelligence feed parsed successfully.' }
]

// ── Components ────────────────────────────────────────────────────────────────

const SeverityBadge = ({ severity }) => {
  const styles = {
    'Critical': 'bg-red-500/10 text-red-500 border-red-500/30',
    'High': 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    'Medium': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    'Low': 'bg-blue-500/10 text-blue-500 border-blue-500/30'
  }
  return (
    <span className={`px-2 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-widest border shadow-sm ${styles[severity] || styles['Medium']}`}>
      {severity}
    </span>
  )
}

const ThreatDrawer = ({ threat, onClose }) => {
  if (!threat) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-3xl bg-[#050B14] border-l border-white/10 h-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden font-sans"
      >
        {/* Drawer Header */}
        <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-b from-red-500/10 to-transparent relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <SeverityBadge severity={threat.severity} />
            <span className="text-xs font-mono text-slate-500">{threat.id}</span>
            <span className="text-xs font-medium text-slate-500 ml-auto mr-12">{threat.publishedTime}</span>
          </div>
          
          <h2 className="text-2xl font-black text-white leading-tight mb-2 pr-12">{threat.name}</h2>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {threat.affectedSystems.map(sys => (
              <span key={sys} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-slate-300 flex items-center gap-1.5">
                <Server size={12} className="text-slate-500" /> {sys}
              </span>
            ))}
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          
          {/* Description */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Activity size={14} className="text-cyan-500" /> Threat Intelligence Summary
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed bg-[#0a0f1c] p-5 rounded-lg border border-white/5">
              {threat.description}
            </p>
          </div>

          {/* MITRE ATT&CK */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Crosshair size={14} className="text-purple-500" /> MITRE ATT&CK Mapping
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {threat.mitre.map(m => (
                <div key={m.id} className="bg-purple-500/5 border border-purple-500/10 p-3 rounded-lg flex items-center gap-3">
                  <div className="bg-purple-500/20 text-purple-400 text-[10px] font-mono font-bold px-2 py-1 rounded">
                    {m.id}
                  </div>
                  <span className="text-sm text-slate-300 font-medium">{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldAlert size={14} className="text-emerald-500" /> Recommended SOC Actions
            </h3>
            <div className="space-y-3">
              {threat.recommendedActions.map((action, idx) => (
                <div key={idx} className="flex gap-3 items-start bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg">
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-200">{action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* IOCs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={14} className="text-red-500" /> Indicators of Compromise (IOCs)
              </h3>
              <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">{threat.iocCount} Total IOCs</span>
            </div>
            <div className="bg-[#0a0f1c] border border-white/5 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 font-bold">Type</th>
                    <th className="px-4 py-3 font-bold">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {threat.iocs.map((ioc, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{ioc.type}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-red-400 break-all">{ioc.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Related Incidents */}
          {threat.relatedIncidents.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <List size={14} className="text-blue-500" /> Related Local Incidents
              </h3>
              <div className="flex gap-3">
                {threat.relatedIncidents.map(inc => (
                  <button key={inc} className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold font-mono hover:bg-blue-500 hover:text-white transition-colors">
                    {inc}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function ThreatFeedPage() {
  const [selectedThreat, setSelectedThreat] = useState(null)

  return (
    <div className="min-h-screen p-4 lg:p-6 space-y-6 bg-[#030712] font-sans selection:bg-red-500/30 text-slate-300">
      
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3 uppercase font-mono">
            <Activity className="text-red-500" size={24} />
            Threat Feed
            <span className="text-[9px] font-bold px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full tracking-widest">
              LIVE INTEL
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Global & Local Cybersecurity Intelligence</p>
        </div>
        <button className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-slate-300 rounded-md text-xs font-bold transition-colors flex items-center gap-2 uppercase tracking-wider">
          <RefreshCw size={14} /> Refresh Feed
        </button>
      </header>

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_STATS.map((stat, idx) => (
          <div key={idx} className="bg-[#0A0F1C] border border-white/5 rounded-lg p-4 relative overflow-hidden group hover:border-white/20 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} blur-[40px] rounded-full -mr-10 -mt-10`} />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 relative z-10">{stat.label}</p>
            <p className={`text-3xl font-black font-mono relative z-10 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* ── LEFT COLUMN (Threat Cards) ── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Latest Intelligence</h2>
            <span className="text-[10px] text-slate-500 font-mono">Showing {MOCK_THREATS.length} alerts</span>
          </div>

          {MOCK_THREATS.map(threat => (
            <motion.div
              key={threat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedThreat(threat)}
              className="bg-[#0A0F1C] border border-white/5 rounded-xl p-5 hover:bg-[#0f172a] hover:border-white/10 transition-all cursor-pointer group flex flex-col sm:flex-row gap-5"
            >
              {/* Left Side Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <SeverityBadge severity={threat.severity} />
                  <span className="text-[10px] font-mono font-bold text-slate-500">{threat.id}</span>
                  <span className="text-[10px] text-slate-600 font-mono ml-auto sm:hidden">{threat.publishedTime}</span>
                </div>
                <h3 className="text-base font-bold text-slate-200 group-hover:text-white transition-colors mb-2 leading-tight">
                  {threat.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed max-w-3xl">
                  {threat.description}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    <Crosshair size={12} className="text-purple-500" /> {threat.mitre.length} TTPs
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    <Terminal size={12} className="text-red-500" /> {threat.iocCount} IOCs
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    <Server size={12} className="text-blue-500" /> {threat.affectedSystems.length} Targets
                  </div>
                </div>
              </div>
              
              {/* Right Side Info (Desktop) */}
              <div className="hidden sm:flex flex-col items-end justify-between border-l border-white/5 pl-5 min-w-[120px]">
                <span className="text-[10px] text-slate-500 font-mono">{threat.publishedTime}</span>
                <ChevronRight size={20} className="text-slate-600 group-hover:text-cyan-500 transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── RIGHT COLUMN (Analytics Panel) ── */}
        <div className="space-y-6">
          
          {/* Global Threat Map Placeholder */}
          <div className="bg-[#0A0F1C] border border-white/5 rounded-xl p-5 h-[280px] flex flex-col relative overflow-hidden">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 z-10 flex items-center gap-2">
              <Globe size={14} className="text-blue-500" /> Active Threat Origin Map
            </h2>
            <div className="flex-1 flex items-center justify-center relative z-10">
              {/* Abstract Map Visualization */}
              <div className="relative w-full h-full flex items-center justify-center opacity-40">
                <Globe size={180} strokeWidth={0.5} className="text-cyan-500 absolute" />
                {/* Ping dots */}
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-purple-500 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                <div className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-amber-500 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 text-[10px] font-mono text-cyan-500 uppercase tracking-widest">
                  Live Feed Connected
                </span>
              </div>
            </div>
            {/* Grid background */}
            <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
          </div>

          {/* Top Attack Types */}
          <div className="bg-[#0A0F1C] border border-white/5 rounded-xl p-5">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Bug size={14} className="text-red-500" /> Global Top Attack Vectors
            </h2>
            <div className="space-y-4">
              {TOP_ATTACKS.map((attack, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-300">{attack.name}</span>
                    <span className="font-mono text-cyan-500">{attack.percentage}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" 
                      style={{ width: `${attack.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent SOC Activity */}
          <div className="bg-[#0A0F1C] border border-white/5 rounded-xl p-5">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={14} className="text-emerald-500" /> Recent Defenses
            </h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-500/20 before:to-transparent">
              {RECENT_ACTIVITY.map((act, idx) => (
                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-3 h-3 rounded-full border border-emerald-500 bg-[#0A0F1C] text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                  {/* Content */}
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] ml-4 md:ml-0 p-3 bg-white/5 rounded-lg border border-white/5 text-xs text-slate-300">
                    <span className="text-[9px] font-mono text-emerald-500 block mb-1">{act.time}</span>
                    {act.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {selectedThreat && (
          <ThreatDrawer 
            threat={selectedThreat} 
            onClose={() => setSelectedThreat(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Shield, Monitor, Printer, Wifi, Mail, Server, Cpu,
  BookOpen, Clock, ThumbsUp, ThumbsDown, X, ChevronRight,
  ChevronLeft, ArrowRight, Image as ImageIcon
} from 'lucide-react'

// ── Mock Data ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'VPN', 'Microsoft 365', 'Printer', 'Windows', 'Mac', 'Email', 'Network', 'Software'
]

const MOCK_ARTICLES = [
  {
    id: 1,
    title: 'Troubleshooting Cisco AnyConnect VPN Failures',
    category: 'VPN',
    summary: 'A complete guide to resolving common "Failed to initialize connection subsystem" errors on Windows 11.',
    difficulty: 'Intermediate',
    time: '5 min read',
    icon: Shield,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    steps: [
      'Open the Task Manager (Ctrl + Shift + Esc).',
      'Navigate to the Services tab and locate "vpnagent".',
      'Right-click and select "Restart".',
      'If the service is stopped, click "Start".',
      'Re-launch the Cisco AnyConnect client and attempt to connect.'
    ],
    related: [2, 7]
  },
  {
    id: 2,
    title: 'Microsoft 365 Authentication Loop',
    category: 'Microsoft 365',
    summary: 'Fix the issue where Outlook or Teams continuously asks for the user password despite successful MFA.',
    difficulty: 'Advanced',
    time: '8 min read',
    icon: Monitor,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    steps: [
      'Close all Office applications (Outlook, Word, Teams).',
      'Open Windows Settings > Accounts > Access work or school.',
      'Select the connected account and click "Disconnect".',
      'Open Credential Manager and clear all "msteams" and "MicrosoftOffice" credentials.',
      'Re-open Outlook and sign in to re-register the device with Azure AD.'
    ],
    related: [6]
  },
  {
    id: 3,
    title: 'Clearing the Print Spooler Queue',
    category: 'Printer',
    summary: 'How to forcefully clear stuck print jobs when a printer appears offline or unresponsive.',
    difficulty: 'Beginner',
    time: '3 min read',
    icon: Printer,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    steps: [
      'Open the Command Prompt as Administrator.',
      'Type "net stop spooler" and press Enter.',
      'Navigate to C:\\Windows\\System32\\spool\\PRINTERS and delete all files in this folder.',
      'Return to Command Prompt, type "net start spooler" and press Enter.',
      'Try printing the document again.'
    ],
    related: [4]
  },
  {
    id: 4,
    title: 'Fixing Wi-Fi "Connected, No Internet"',
    category: 'Network',
    summary: 'Steps to resolve DNS or IP conflicts causing local network access without internet connectivity.',
    difficulty: 'Intermediate',
    time: '6 min read',
    icon: Wifi,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    steps: [
      'Open Command Prompt as Administrator.',
      'Type "ipconfig /release" and press Enter.',
      'Type "ipconfig /renew" and press Enter.',
      'Type "ipconfig /flushdns" and press Enter.',
      'If the issue persists, change DNS adapter settings to 8.8.8.8 and 1.1.1.1.'
    ],
    related: [1]
  },
  {
    id: 5,
    title: 'Mac: Resetting NVRAM and SMC',
    category: 'Mac',
    summary: 'Resolve strange hardware behaviors on Intel Macs including display, power, and bluetooth issues.',
    difficulty: 'Beginner',
    time: '4 min read',
    icon: Cpu,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    steps: [
      'Shut down the Mac completely.',
      'Turn it on and immediately press and hold Option, Command, P, and R.',
      'Keep holding the keys for about 20 seconds.',
      'Release the keys when you hear the startup sound for the second time (or see the Apple logo appear and disappear twice).',
      'The NVRAM is now reset. Reconfigure volume or display resolution if needed.'
    ],
    related: [8]
  },
  {
    id: 6,
    title: 'Outlook OST File Corruption Recovery',
    category: 'Email',
    summary: 'How to rebuild an Outlook data file when the application fails to open or search breaks.',
    difficulty: 'Intermediate',
    time: '7 min read',
    icon: Mail,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    steps: [
      'Ensure Outlook is completely closed.',
      'Press Windows Key + R, type "%localappdata%\\Microsoft\\Outlook" and hit Enter.',
      'Locate the file ending in .ost that matches the user email.',
      'Rename the file to end with .old (e.g., user@domain.com.old).',
      'Restart Outlook. It will automatically download a fresh copy of the mailbox from Exchange.'
    ],
    related: [2]
  }
]

// ── Components ────────────────────────────────────────────────────────────────

const DifficultyBadge = ({ level }) => {
  const colors = {
    'Beginner': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Intermediate': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Advanced': 'bg-red-500/10 text-red-400 border-red-500/20'
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[level]}`}>
      {level}
    </span>
  )
}

const ArticleModal = ({ article, onClose, onOpenArticle }) => {
  if (!article) return null

  const relatedArticles = MOCK_ARTICLES.filter(a => article.related.includes(a.id))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-2xl bg-[#0a0f1c] border-l border-white/10 h-full shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/10 bg-gradient-to-b from-cyan-500/5 to-transparent relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg transition-colors">
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-xl ${article.bg} ${article.color}`}>
              <article.icon size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{article.category}</span>
          </div>
          
          <h2 className="text-2xl font-black text-white leading-tight mb-4 pr-12">{article.title}</h2>
          
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <DifficultyBadge level={article.difficulty} />
            <span className="flex items-center gap-1.5"><Clock size={14} /> {article.time}</span>
            <span className="flex items-center gap-1.5"><BookOpen size={14} /> IT Support Library</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          
          {/* Summary */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3">Overview</h3>
            <p className="text-slate-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 text-sm">
              {article.summary}
            </p>
          </div>

          {/* Step by Step Guide */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Step-by-Step Guide</h3>
            <div className="space-y-4">
              {article.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(34,211,238,0.1)] group-hover:bg-cyan-500 group-hover:text-white transition-all">
                    {idx + 1}
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Screenshot Placeholder */}
          <div className="bg-[#1e293b]/50 border border-white/10 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-slate-500">
            <ImageIcon size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">Reference Screenshot</p>
            <p className="text-xs mt-1 text-center max-w-xs">Visual aid showing the expected outcome of the steps above.</p>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Related Articles</h3>
              <div className="grid grid-cols-1 gap-3">
                {relatedArticles.map(rel => (
                  <button 
                    key={rel.id} 
                    onClick={() => onOpenArticle(rel)}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <rel.icon size={16} className={rel.color} />
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white">{rel.title}</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer (Helpful?) */}
        <div className="p-6 border-t border-white/10 bg-black/20 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-400">Was this article helpful?</p>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-bold transition-all">
              <ThumbsUp size={16} /> Yes
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500 hover:text-white rounded-lg text-sm font-bold transition-all">
              <ThumbsDown size={16} /> No
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedArticle, setSelectedArticle] = useState(null)

  const filteredArticles = MOCK_ARTICLES.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          article.summary.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'All' || article.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8 bg-[#030712] font-sans selection:bg-cyan-500/30 text-slate-300">
      
      {/* ── HEADER & SEARCH ── */}
      <header className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Knowledge Base
            <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full tracking-widest uppercase shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              IT Support Library
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Search through internal troubleshooting guides, standard operating procedures, and fixes.</p>
        </div>

        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" size={20} />
          <input 
            type="text" 
            placeholder="Search for VPN issues, printer offline, password reset..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 shadow-xl transition-all"
          />
        </div>
      </header>

      {/* ── CATEGORIES ── */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              activeCategory === category 
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* ── ARTICLE CARDS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredArticles.map((article) => (
            <motion.div
              key={article.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedArticle(article)}
              className="bg-[#0a0f1c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl hover:bg-white/5 hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)] transition-all cursor-pointer group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-5">
                <div className={`p-3 rounded-xl ${article.bg} ${article.color}`}>
                  <article.icon size={24} />
                </div>
                <DifficultyBadge level={article.difficulty} />
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors leading-tight mb-3">
                {article.title}
              </h3>
              
              <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
                {article.summary}
              </p>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><Clock size={14} /> {article.time}</span>
                <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 uppercase tracking-widest font-bold text-[10px]">
                  Read <ArrowRight size={12} />
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredArticles.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-white/5 border border-white/5 rounded-2xl border-dashed">
          <BookOpen size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-medium text-white">No articles found matching "{searchQuery}"</p>
          <p className="text-xs mt-1">Try adjusting your search or category filter.</p>
        </div>
      )}

      {/* ── MODAL ── */}
      <AnimatePresence>
        {selectedArticle && (
          <ArticleModal 
            article={selectedArticle} 
            onClose={() => setSelectedArticle(null)}
            onOpenArticle={(article) => setSelectedArticle(article)} 
          />
        )}
      </AnimatePresence>

    </div>
  )
}

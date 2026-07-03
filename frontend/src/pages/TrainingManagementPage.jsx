import { useState, useEffect } from 'react'
import {
  getTrainingVideos,
  createTrainingVideo,
  updateTrainingVideo,
  deleteTrainingVideo
} from '../api/training'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TOPICS = [
  'All', 'Support', 'Phishing', 'Password Security', 'MFA', 'Social Engineering', 
  'Email Security', 'Safe Browsing', 'Remote Work Security', 'Data Protection', 
  'Device Security', 'Compliance', 'Custom Topics'
]

const STATUS_COLORS = {
  Active: 'var(--color-soc-green)',
  Inactive: 'var(--color-soc-text-dim)',
}

const DIFFICULTY_STYLES = {
  Beginner: 'status-info',
  Intermediate: 'status-warning',
  Advanced: 'status-critical',
}

// Helper to mock missing backend fields deterministically
function enrichVideoData(v) {
  const idStr = String(v.id || v.title)
  const hash = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const difficulties = ['Beginner', 'Intermediate', 'Advanced']
  const thumbs = [
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400&h=250',
    'https://images.unsplash.com/photo-1614064641913-6b7140414f14?auto=format&fit=crop&q=80&w=400&h=250',
    'https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&q=80&w=400&h=250',
    'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400&h=250'
  ]

  return {
    ...v,
    status: v.is_active ? 'Active' : 'Inactive',
    difficulty: difficulties[hash % 3],
    duration: `${10 + (hash % 40)}:${(hash * 7) % 60 < 10 ? '0' : ''}${(hash * 7) % 60}`,
    views: 100 + (hash * 123) % 5000,
    completionRate: 40 + (hash * 13) % 60,
    thumbnail: thumbs[hash % thumbs.length],
    createdBy: 'Admin User',
    createdAt: v.created_at || new Date().toISOString(),
    youtubeUrl: v.youtube_url || ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-card)] overflow-hidden animate-pulse">
      <div className="w-full h-40 bg-[var(--color-soc-surface)]" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-[var(--color-soc-border-subtle)] rounded w-3/4" />
        <div className="h-3 bg-[var(--color-soc-border-subtle)] rounded w-1/2" />
        <div className="flex gap-2 pt-2">
          <div className="h-6 bg-[var(--color-soc-surface)] rounded-full w-16" />
          <div className="h-6 bg-[var(--color-soc-surface)] rounded-full w-20" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color: color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold">{title}</p>
        <p className="text-2xl font-black text-[var(--color-soc-text)] mt-1">{value}</p>
      </div>
    </div>
  )
}

export default function TrainingManagementPage() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [topicFilter, setTopicFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')

  // Modals / Expanded View
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [deletingVideo, setDeletingVideo] = useState(null)
  const [expandedVideo, setExpandedVideo] = useState(null)
  
  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formTopic, setFormTopic] = useState('Phishing')
  const [formUrl, setFormUrl] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formStatus, setFormStatus] = useState('Active')

  // Data Fetching
  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getTrainingVideos()
      setVideos(data.map(enrichVideoData))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  // Setup form when editing
  useEffect(() => {
    if (editingVideo) {
      setFormTitle(editingVideo.title)
      setFormTopic(editingVideo.topic)
      setFormUrl(editingVideo.youtubeUrl)
      setFormDesc(editingVideo.description)
      setFormStatus(editingVideo.status)
    } else {
      setFormTitle('')
      setFormTopic('Phishing')
      setFormUrl('')
      setFormDesc('')
      setFormStatus('Active')
    }
  }, [editingVideo, showAddModal])

  // Actions
  const handleSaveVideo = async () => {
    try {
      if (editingVideo) {
        await updateTrainingVideo(editingVideo.id, {
          title: formTitle,
          topic: formTopic,
          youtube_url: formUrl,
          description: formDesc,
          is_active: formStatus === 'Active'
        })
      } else {
        await createTrainingVideo({
          title: formTitle,
          topic: formTopic,
          youtube_url: formUrl,
          description: formDesc
        })
      }
      setShowAddModal(false)
      setEditingVideo(null)
      fetchVideos()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to save video')
    }
  }

  const handleDeleteVideo = async () => {
    try {
      await deleteTrainingVideo(deletingVideo.id)
      setDeletingVideo(null)
      fetchVideos()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to delete video')
    }
  }

  // ── Derived Data ──
  const totalVideos = videos.length
  const activeVideos = videos.filter(v => v.status === 'Active').length
  const inactiveVideos = totalVideos - activeVideos
  const totalViews = videos.reduce((acc, v) => acc + v.views, 0)
  const avgCompletion = totalVideos ? Math.round(videos.reduce((acc, v) => acc + v.completionRate, 0) / totalVideos) : 0
  const uniqueTopics = new Set(videos.map(v => v.topic)).size

  // Filtering
  let filtered = videos.filter(v => {
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase())
    const matchTopic = topicFilter === 'All' || v.topic === topicFilter
    const matchStatus = statusFilter === 'All' || v.status === statusFilter
    const matchDiff = difficultyFilter === 'All' || v.difficulty === difficultyFilter
    return matchSearch && matchTopic && matchStatus && matchDiff
  })

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === 'Newest') return new Date(b.createdAt) - new Date(a.createdAt)
    if (sortBy === 'Most Viewed') return b.views - a.views
    if (sortBy === 'Highest Completion') return b.completionRate - a.completionRate
    return 0
  })

  // Analytics Sidebar
  const mostViewed = [...videos].sort((a,b) => b.views - a.views)[0]
  const mostCompleted = [...videos].sort((a,b) => b.completionRate - a.completionRate)[0]
  const leastViewed = [...videos].sort((a,b) => a.views - b.views)[0]
  const recentlyAdded = [...videos].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3)

  // ── Render Helpers ──
  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] text-sm text-[var(--color-soc-text)] focus:border-[var(--color-soc-accent)] outline-none"
  const selectCls = "px-3 py-2 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-xs text-[var(--color-soc-text)] outline-none cursor-pointer focus:border-[var(--color-soc-accent)]"

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-xl border border-[var(--color-soc-red)] bg-[var(--color-soc-red-glow)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <p className="text-sm font-bold text-[var(--color-soc-red)]">Backend Unreachable</p>
              <p className="text-xs text-[var(--color-soc-text-muted)] mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={fetchVideos} className="px-4 py-1.5 rounded bg-[var(--color-soc-red)] text-white text-xs font-bold hover:opacity-90">Retry</button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-soc-text)] tracking-tight">Training Management</h1>
          <p className="text-sm text-[var(--color-soc-text-muted)] mt-1">Manage security awareness videos and learning content.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchVideos} title="Refresh"
            className="p-2.5 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] hover:text-[var(--color-soc-accent)] hover:border-[var(--color-soc-accent)] transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>
          <button className="px-4 py-2.5 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-sm font-semibold hover:bg-[var(--color-soc-surface)] transition-colors flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 16px var(--color-soc-accent-glow)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Video
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Videos" value={totalVideos} icon="🎥" color="var(--color-soc-accent)" />
        <StatCard title="Active" value={activeVideos} icon="✅" color="var(--color-soc-green)" />
        <StatCard title="Inactive" value={inactiveVideos} icon="⏸️" color="var(--color-soc-text-muted)" />
        <StatCard title="Topics" value={uniqueTopics} icon="📚" color="var(--color-soc-amber)" />
        <StatCard title="Total Views" value={totalViews.toLocaleString()} icon="👁️" color="var(--color-soc-accent)" />
        <StatCard title="Avg Completion" value={`${avgCompletion}%`} icon="📈" color="var(--color-soc-green)" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* ── Main Content (Left 3 cols) ── */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Filters */}
          <div className="p-4 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-soc-text-dim)]">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Search videos by title..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] text-sm text-[var(--color-soc-text)] outline-none focus:border-[var(--color-soc-accent)]" />
            </div>
            
            <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className={selectCls}>
              {TOPICS.map(t => <option key={t} value={t}>{t === 'All' ? 'All Topics' : t}</option>)}
            </select>
            
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)} className={selectCls}>
              <option value="All">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            <div className="h-6 w-px bg-[var(--color-soc-border-subtle)] mx-1" />

            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selectCls}>
              <option value="Newest">Sort: Newest</option>
              <option value="Most Viewed">Sort: Most Viewed</option>
              <option value="Highest Completion">Sort: Highest Completion</option>
            </select>
          </div>

          {/* Video Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-text-muted)" strokeWidth={1.5} className="w-8 h-8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <h3 className="text-lg font-bold text-[var(--color-soc-text)]">No training videos found.</h3>
              <p className="text-sm text-[var(--color-soc-text-muted)] mt-1 max-w-md">Try adjusting your filters or click "Add Video" to upload a new training resource to the platform.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(v => (
                <div key={v.id} className="group rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] overflow-hidden hover:border-[var(--color-soc-accent)] transition-all flex flex-col">
                  {/* Thumbnail area */}
                  <div className="relative aspect-video bg-[var(--color-soc-surface)] border-b border-[var(--color-soc-border-subtle)] cursor-pointer overflow-hidden" onClick={() => setExpandedVideo(v)}>
                    <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded border bg-black/60 backdrop-blur-md"
                      style={{ borderColor: `${STATUS_COLORS[v.status]}40` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[v.status], boxShadow: `0 0 6px ${STATUS_COLORS[v.status]}` }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white">{v.status}</span>
                    </div>

                    {/* Duration Badge */}
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-white font-semibold">
                      {v.duration}
                    </div>

                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] flex items-center justify-center shadow-[0_0_20px_var(--color-soc-accent-glow)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-[var(--color-soc-text)] line-clamp-2 leading-snug cursor-pointer hover:text-[var(--color-soc-accent)]" onClick={() => setExpandedVideo(v)}>
                        {v.title}
                      </h3>
                      {/* Actions Menu */}
                      <div className="relative group/menu flex-shrink-0">
                        <button className="p-1 rounded text-[var(--color-soc-text-dim)] hover:text-[var(--color-soc-text)] hover:bg-[var(--color-soc-surface)]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-32 bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 flex flex-col p-1">
                          <button onClick={() => setExpandedVideo(v)} className="text-left px-3 py-1.5 text-xs text-[var(--color-soc-text)] hover:bg-[var(--color-soc-card)] hover:text-[var(--color-soc-accent)] rounded">View Details</button>
                          <button onClick={() => setEditingVideo(v)} className="text-left px-3 py-1.5 text-xs text-[var(--color-soc-text)] hover:bg-[var(--color-soc-card)] hover:text-[var(--color-soc-accent)] rounded">Edit Video</button>
                          <div className="h-px bg-[var(--color-soc-border-subtle)] my-1" />
                          <button onClick={() => setDeletingVideo(v)} className="text-left px-3 py-1.5 text-xs text-[var(--color-soc-red)] hover:bg-[var(--color-soc-red-glow)] rounded">Delete</button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold text-[var(--color-soc-accent)] bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] uppercase tracking-wider">{v.topic}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${DIFFICULTY_STYLES[v.difficulty]}`}>{v.difficulty}</span>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-3 pt-3 border-t border-[var(--color-soc-border-subtle)]">
                      <div>
                        <p className="text-[10px] text-[var(--color-soc-text-dim)] uppercase tracking-wider font-semibold mb-0.5">Views</p>
                        <p className="text-xs font-mono font-medium text-[var(--color-soc-text)]">{v.views.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--color-soc-text-dim)] uppercase tracking-wider font-semibold mb-0.5">Completion</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-mono font-medium text-[var(--color-soc-text)]">{v.completionRate}%</p>
                          <div className="flex-1 h-1 rounded-full bg-[var(--color-soc-surface)]">
                            <div className="h-full rounded-full bg-[var(--color-soc-green)]" style={{ width: `${v.completionRate}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar (Analytics) ── */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--color-soc-border-subtle)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-5 h-5"><path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/></svg>
              <h2 className="font-bold text-[var(--color-soc-text)]">Training Analytics</h2>
            </div>
            
            <div className="space-y-5">
              {mostViewed && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-2">Most Viewed Video</p>
                  <div className="p-3 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] cursor-pointer hover:border-[var(--color-soc-accent)] transition-colors" onClick={() => setExpandedVideo(mostViewed)}>
                    <p className="text-xs font-bold text-[var(--color-soc-text)] line-clamp-1">{mostViewed.title}</p>
                    <p className="text-[10px] text-[var(--color-soc-accent)] mt-1">{mostViewed.views.toLocaleString()} views</p>
                  </div>
                </div>
              )}
              {mostCompleted && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-2">Highest Completion</p>
                  <div className="p-3 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] cursor-pointer hover:border-[var(--color-soc-accent)] transition-colors" onClick={() => setExpandedVideo(mostCompleted)}>
                    <p className="text-xs font-bold text-[var(--color-soc-text)] line-clamp-1">{mostCompleted.title}</p>
                    <p className="text-[10px] text-[var(--color-soc-green)] mt-1">{mostCompleted.completionRate}% completion rate</p>
                  </div>
                </div>
              )}
              {leastViewed && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-muted)] font-semibold mb-2">Needs Attention (Low Views)</p>
                  <div className="p-3 rounded-xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] cursor-pointer hover:border-[var(--color-soc-red)] transition-colors" onClick={() => setExpandedVideo(leastViewed)}>
                    <p className="text-xs font-bold text-[var(--color-soc-text)] line-clamp-1">{leastViewed.title}</p>
                    <p className="text-[10px] text-[var(--color-soc-red)] mt-1">{leastViewed.views.toLocaleString()} views</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
            <h2 className="text-xs font-bold text-[var(--color-soc-text)] uppercase tracking-wider mb-4">Recently Added</h2>
            <div className="space-y-3">
              {recentlyAdded.map(v => (
                <div key={v.id} onClick={() => setExpandedVideo(v)} className="flex gap-3 items-center group cursor-pointer">
                  <img src={v.thumbnail} alt="" className="w-12 h-8 rounded object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div>
                    <p className="text-[11px] font-bold text-[var(--color-soc-text)] line-clamp-1 group-hover:text-[var(--color-soc-accent)] transition-colors">{v.title}</p>
                    <p className="text-[9px] text-[var(--color-soc-text-dim)] mt-0.5">{new Date(v.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--color-soc-accent)] bg-[var(--color-soc-accent-glow)] flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={2} className="w-4 h-4 mt-0.5 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-[10px] text-[var(--color-soc-accent)] leading-relaxed">
              <strong>Future Integration:</strong> Videos created here will automatically be recommended to employees in the Employee Portal based on their incident history and security questions.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      
      {/* Expanded View Modal */}
      {expandedVideo && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 fade-in" onClick={() => setExpandedVideo(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-3xl rounded-2xl bg-[var(--color-soc-surface)] border border-[var(--color-soc-border-subtle)] shadow-2xl pointer-events-auto fade-in overflow-hidden flex flex-col max-h-[90vh]">
              <div className="relative aspect-video bg-black flex-shrink-0 border-b border-[var(--color-soc-border-subtle)]">
                {/* Simulated player */}
                <img src={expandedVideo.thumbnail} alt="" className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <a href={expandedVideo.youtubeUrl} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-full bg-[var(--color-soc-accent)] text-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-[0_0_30px_var(--color-soc-accent-glow)]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </a>
                </div>
                <button onClick={() => setExpandedVideo(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 backdrop-blur">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-black text-[var(--color-soc-text)]">{expandedVideo.title}</h2>
                    <p className="text-xs text-[var(--color-soc-text-dim)] mt-1 font-mono">ID: {expandedVideo.id} · Created by {expandedVideo.createdBy} on {new Date(expandedVideo.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingVideo(expandedVideo); setExpandedVideo(null) }} className="px-3 py-1.5 rounded bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] text-xs font-semibold hover:border-[var(--color-soc-accent)] transition-colors">Edit</button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap mb-6">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold text-white`} style={{ backgroundColor: STATUS_COLORS[expandedVideo.status] }}>{expandedVideo.status}</span>
                  <span className="px-2 py-1 rounded text-[10px] font-bold text-[var(--color-soc-accent)] bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] uppercase">{expandedVideo.topic}</span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold border ${DIFFICULTY_STYLES[expandedVideo.difficulty]}`}>{expandedVideo.difficulty}</span>
                  <span className="text-[11px] font-mono font-semibold text-[var(--color-soc-text-muted)] flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {expandedVideo.duration}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1">Total Views</p>
                    <p className="text-lg font-mono font-bold text-[var(--color-soc-text)]">{expandedVideo.views.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1">Completion</p>
                    <p className="text-lg font-mono font-bold text-[var(--color-soc-green)]">{expandedVideo.completionRate}%</p>
                  </div>
                  <div className="col-span-2 p-3 rounded-xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-soc-text-dim)] font-semibold mb-1">Source URL</p>
                    <a href={expandedVideo.youtubeUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-soc-accent)] hover:underline break-all block truncate">{expandedVideo.youtubeUrl}</a>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[var(--color-soc-text-muted)] uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-[var(--color-soc-text)] leading-relaxed">{expandedVideo.description}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {(showAddModal || editingVideo) && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 fade-in" onClick={() => { setShowAddModal(false); setEditingVideo(null) }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] shadow-2xl fade-in overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-soc-border-subtle)] flex items-center justify-between">
                <h2 className="text-base font-bold text-[var(--color-soc-text)]">{editingVideo ? 'Edit Video Details' : 'Add New Training Video'}</h2>
                <button onClick={() => { setShowAddModal(false); setEditingVideo(null) }} className="text-[var(--color-soc-text-muted)] hover:text-white"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Video Title *</label>
                  <input type="text" className={inputCls} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Recognizing Phishing Emails" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Topic *</label>
                    <select className={`${inputCls} py-2.5`} value={formTopic} onChange={e => setFormTopic(e.target.value)}>
                      {TOPICS.filter(t => t !== 'All').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Difficulty (Mocked)</label>
                    <input type="text" className={`${inputCls} opacity-50 cursor-not-allowed`} disabled value="Generated automatically" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Video URL (YouTube/Vimeo) *</label>
                  <input type="url" className={inputCls} value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Duration (Mocked)</label>
                    <input type="text" className={`${inputCls} opacity-50 cursor-not-allowed`} disabled value="Generated automatically" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Status</label>
                    <select className={`${inputCls} py-2.5`} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--color-soc-text-muted)] mb-1.5">Description</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Summary of the learning objectives..." />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[var(--color-soc-border-subtle)] bg-[var(--color-soc-surface)] flex justify-end gap-3">
                <button onClick={() => { setShowAddModal(false); setEditingVideo(null) }} className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--color-soc-text-muted)] hover:text-white transition-colors">Cancel</button>
                <button onClick={handleSaveVideo} disabled={!formTitle || !formUrl} className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--color-soc-accent)] text-[var(--color-soc-bg)] hover:opacity-90 shadow-[0_0_15px_var(--color-soc-accent-glow)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {editingVideo ? 'Save Changes' : 'Add Video'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 fade-in" onClick={() => setDeletingVideo(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] shadow-2xl fade-in overflow-hidden text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-soc-red-glow)] border border-[rgba(255,59,92,0.2)] flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-red)" strokeWidth={2} className="w-8 h-8"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
              </div>
              <h2 className="text-lg font-bold text-[var(--color-soc-text)] mb-2">Delete Training Video?</h2>
              <p className="text-sm text-[var(--color-soc-text-muted)] mb-6">Are you sure you want to delete "<strong className="text-[var(--color-soc-text)]">{deletingVideo.title}</strong>"? This action cannot be undone and will remove it from all employee learning paths.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleDeleteVideo} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[var(--color-soc-red)] text-white hover:opacity-90 shadow-[0_0_15px_var(--color-soc-red-glow)] transition-all">
                  Yes, Delete Video
                </button>
                <button onClick={() => setDeletingVideo(null)} className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[var(--color-soc-border-subtle)] text-[var(--color-soc-text-muted)] hover:border-[var(--color-soc-text)] hover:text-[var(--color-soc-text)] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}

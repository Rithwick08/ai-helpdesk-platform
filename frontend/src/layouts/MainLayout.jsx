import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-soc-bg)] grid-bg">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 transition-all duration-300">
        {/* Top navigation bar */}
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 fade-in">
            <Outlet />
          </div>
        </main>

        {/* Footer strip */}
        <footer className="border-t border-[var(--color-soc-border-subtle)] px-4 lg:px-6 py-2 flex items-center justify-between text-[10px] text-[var(--color-soc-text-dim)]">
          <span>CyberShield AI Platform v1.0.0 — Classification: INTERNAL</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-soc-green)]" />
            System Operational
          </span>
        </footer>
      </div>
    </div>
  )
}

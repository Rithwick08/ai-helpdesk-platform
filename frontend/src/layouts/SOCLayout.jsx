import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import { Shield, ShieldAlert, Activity, LogOut } from 'lucide-react'

const navItems = [
  { id: 'soc', label: 'Security Dashboard', path: '/soc', icon: <Shield size={20} /> },
  { id: 'incidents', label: 'Security Incidents', path: '/soc-incidents', icon: <ShieldAlert size={20} /> },
  { id: 'threat-feed', label: 'Threat Feed', path: '/threat-feed', icon: <Activity size={20} /> },
  { id: 'logout', label: 'Logout', path: '#', icon: <LogOut size={20} /> },
]

export default function SOCLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-soc-bg)] grid-bg">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={navItems}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 transition-all duration-300">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

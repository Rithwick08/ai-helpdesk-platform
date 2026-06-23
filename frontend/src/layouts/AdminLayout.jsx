import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import {
  LayoutDashboard, Users, ShieldAlert, Ticket,
  KeyRound, PlaySquare, BellRing, LineChart,
  Settings, LogOut
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'users', label: 'User Management', path: '/users', icon: <Users size={20} /> },
  { id: 'incidents', label: 'Security Incidents', path: '/incidents', icon: <ShieldAlert size={20} /> },
  { id: 'it-tickets', label: 'IT Tickets', path: '/it-tickets', icon: <Ticket size={20} /> },
  { id: 'password-reset', label: 'Password Resets', path: '/password-reset', icon: <KeyRound size={20} /> },
  { id: 'training', label: 'Training Videos', path: '/training-management', icon: <PlaySquare size={20} /> },
  { id: 'security-updates', label: 'Security Updates', path: '/security-updates', icon: <BellRing size={20} /> },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: <LineChart size={20} /> },
  { id: 'settings', label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  { id: 'logout', label: 'Logout', path: '#', icon: <LogOut size={20} /> },
]

export default function AdminLayout() {
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

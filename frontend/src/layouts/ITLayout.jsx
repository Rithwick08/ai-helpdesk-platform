import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import { Ticket, TicketCheck, Book, LogOut } from 'lucide-react'

const navItems = [
  { id: 'it-support', label: 'Open Tickets', path: '/it-support', icon: <Ticket size={20} /> },
  { id: 'assigned-tickets', label: 'Assigned Tickets', path: '/assigned-tickets', icon: <TicketCheck size={20} /> },
  { id: 'knowledge-base', label: 'Knowledge Base', path: '/knowledge-base', icon: <Book size={20} /> },
  { id: 'logout', label: 'Logout', path: '#', icon: <LogOut size={20} /> },
]

export default function ITLayout() {
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

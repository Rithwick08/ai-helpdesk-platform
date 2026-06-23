import { Outlet } from 'react-router-dom'
import EmployeeNavbar from '../components/EmployeeNavbar'

/**
 * EmployeeLayout — shell for the Employee AI Portal.
 * Renders the premium EmployeeNavbar fixed at the top, then the page content.
 */
export default function EmployeeLayout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#07080f' }}>

      {/* Fixed premium navbar */}
      <EmployeeNavbar />

      {/* Page content — offset by navbar height (60px) */}
      <main className="flex-1" style={{ paddingTop: '60px' }}>
        <Outlet />
      </main>
    </div>
  )
}

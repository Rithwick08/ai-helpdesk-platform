import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RoleProtectedRoute from './components/RoleProtectedRoute'

// Layouts
import AdminLayout from './layouts/AdminLayout'
import ITLayout from './layouts/ITLayout'
import SOCLayout from './layouts/SOCLayout'
import EmployeeLayout from './layouts/EmployeeLayout'

// Public pages
import LandingPage from './pages/LandingPage'
import LoginPage   from './pages/LoginPage'

// Employee pages
import AssistantPage        from './pages/AssistantPage'
import EmployeeSecurityPage from './pages/EmployeeSecurityPage'
import MyActivityPage       from './pages/MyActivityPage'

// Admin / SOC / IT pages
import Dashboard              from './pages/Dashboard'
import IncidentPage           from './pages/IncidentPage'
import ITSupportPage          from './pages/ITSupportPage'
import PasswordResetPage      from './pages/PasswordResetPage'
import SOCPage                from './pages/SOCPage'
import SecurityAwarenessPage  from './pages/SecurityAwarenessPage'
// import VoiceAssistantPage     from './pages/VoiceAssistantPage' // No longer used in main routing unless needed

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* ── Public routes ── */}
          <Route path="/"      element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* ── Admin Portal ── */}
          <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard"          element={<Dashboard />} />
              <Route path="/users"              element={<Dashboard />} /> {/* Placeholder */}
              <Route path="/incidents"          element={<IncidentPage />} />
              <Route path="/it-tickets"         element={<Dashboard />} /> {/* Placeholder */}
              <Route path="/password-reset"     element={<PasswordResetPage />} />
              <Route path="/training-management" element={<SecurityAwarenessPage />} />
              <Route path="/security-updates"   element={<Dashboard />} /> {/* Placeholder */}
              <Route path="/analytics"          element={<Dashboard />} /> {/* Placeholder */}
              <Route path="/settings"           element={<Dashboard />} /> {/* Placeholder */}
            </Route>
          </Route>

          {/* ── Employee Portal ── */}
          <Route element={<RoleProtectedRoute allowedRoles={['employee', 'admin']} />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/assistant"   element={<AssistantPage />} />
              <Route path="/security"    element={<EmployeeSecurityPage />} />
              <Route path="/my-activity" element={<MyActivityPage />} />
            </Route>
          </Route>

          {/* ── IT Support Portal ── */}
          <Route element={<RoleProtectedRoute allowedRoles={['it', 'admin']} />}>
            <Route element={<ITLayout />}>
              <Route path="/it-support"         element={<ITSupportPage />} />
              <Route path="/assigned-tickets"   element={<Dashboard />} /> {/* Placeholder */}
              <Route path="/knowledge-base"     element={<Dashboard />} /> {/* Placeholder */}
            </Route>
          </Route>

          {/* ── SOC Analyst Portal ── */}
          <Route element={<RoleProtectedRoute allowedRoles={['soc', 'admin']} />}>
            <Route element={<SOCLayout />}>
              <Route path="/soc"                element={<SOCPage />} />
              <Route path="/soc-incidents"      element={<IncidentPage />} />
              <Route path="/threat-feed"        element={<Dashboard />} /> {/* Placeholder */}
            </Route>
          </Route>

          {/* ── Catch-all → landing ── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

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
import AssignedTicketsPage    from './pages/AssignedTicketsPage'
import Dashboard              from './pages/Dashboard'
import IncidentPage           from './pages/IncidentPage'
import ITSupportPage          from './pages/ITSupportPage'
import KnowledgeBasePage      from './pages/KnowledgeBasePage'
import PasswordResetPage      from './pages/PasswordResetPage'
import SOCPage                from './pages/SOCPage'
import ThreatFeedPage         from './pages/ThreatFeedPage'
import AnalyticsPage          from './pages/AnalyticsPage'
import SecurityAwarenessPage  from './pages/SecurityAwarenessPage'
import TrainingManagementPage from './pages/TrainingManagementPage'
import SecurityUpdatesPage    from './pages/SecurityUpdatesPage'
import SettingsPage           from './pages/SettingsPage'
import UsersPage              from './pages/UsersPage'
import ITTicketsPage          from './pages/ITTicketsPage'
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
              <Route path="/users"              element={<UsersPage />} />
              <Route path="/incidents"          element={<IncidentPage />} />
              <Route path="/it-tickets"         element={<ITTicketsPage />} />
              <Route path="/my-tickets"         element={<AssignedTicketsPage />} />
              <Route path="/knowledge-base"     element={<KnowledgeBasePage />} />
              <Route path="/threat-feed"        element={<ThreatFeedPage />} />
              <Route path="/password-reset"     element={<PasswordResetPage />} />
              <Route path="/training-management" element={<TrainingManagementPage />} />
              <Route path="/security-updates"   element={<SecurityUpdatesPage />} />
              <Route path="/analytics"          element={<AnalyticsPage />} />
              <Route path="/settings"           element={<SettingsPage />} />
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

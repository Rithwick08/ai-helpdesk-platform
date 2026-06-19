import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Layouts
import MainLayout       from './layouts/MainLayout'
import AssistantLayout  from './layouts/AssistantLayout'

// Public pages
import LandingPage from './pages/LandingPage'
import LoginPage   from './pages/LoginPage'

// Employee portal
import AssistantPage from './pages/AssistantPage'

// Admin / SOC pages
import Dashboard              from './pages/Dashboard'
import IncidentPage           from './pages/IncidentPage'
import ITSupportPage          from './pages/ITSupportPage'
import PasswordResetPage      from './pages/PasswordResetPage'
import SOCPage                from './pages/SOCPage'
import SecurityAwarenessPage  from './pages/SecurityAwarenessPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes (no layout shell) ── */}
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ── Employee Portal ── */}
        <Route element={<AssistantLayout />}>
          <Route path="/assistant" element={<AssistantPage />} />
        </Route>

        {/* ── Admin / SOC Portal ── */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard"          element={<Dashboard />} />
          <Route path="/incidents"          element={<IncidentPage />} />
          <Route path="/soc"                element={<SOCPage />} />
          <Route path="/it-support"         element={<ITSupportPage />} />
          <Route path="/password-reset"     element={<PasswordResetPage />} />
          <Route path="/security-awareness" element={<SecurityAwarenessPage />} />
        </Route>

        {/* ── Catch-all → landing ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

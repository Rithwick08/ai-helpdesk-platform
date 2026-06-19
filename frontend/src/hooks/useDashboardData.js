/**
 * useDashboardData.js
 * Custom hook that fetches all four dashboard data sources in parallel.
 *
 * Returns:
 *   {
 *     incidents:     Incident[]   | null
 *     alerts:        Alert[]      | null
 *     itTickets:     ITTicket[]   | null
 *     pwResets:      PWReset[]    | null
 *     loading:       boolean
 *     error:         string | null
 *     backendOnline: boolean
 *     refetch:       () => void
 *   }
 *
 * - All four calls fire concurrently via Promise.allSettled
 *   so a single failing endpoint never blocks the rest.
 * - Falls back to dummyData counts when backend is unreachable.
 */

import { useState, useEffect, useCallback } from 'react'
import { getIncidents } from '../api/incidentService'
import { getAlerts } from '../api/alertService'
import { getITTickets } from '../api/itTicketService'
import { getPasswordResets } from '../api/passwordResetService'

function settled(promise) {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  )
}

export function useDashboardData() {
  const [incidents, setIncidents]       = useState(null)
  const [alerts, setAlerts]             = useState(null)
  const [itTickets, setItTickets]       = useState(null)
  const [pwResets, setPwResets]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [backendOnline, setBackendOnline] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [incRes, alRes, tickRes, pwRes] = await Promise.allSettled([
      settled(getIncidents()),
      settled(getAlerts()),
      settled(getITTickets()),
      settled(getPasswordResets()),
    ])

    // Determine backend reachability — if ALL four fail it's offline
    const allFailed = [incRes, alRes, tickRes, pwRes].every(
      (r) => r.status === 'fulfilled' && !r.value.ok,
    )
    setBackendOnline(!allFailed)

    // Hydrate state from settled results (nulls trigger fallback in Dashboard)
    setIncidents(incRes.status === 'fulfilled' && incRes.value.ok ? incRes.value.value : null)
    setAlerts(alRes.status   === 'fulfilled' && alRes.value.ok   ? alRes.value.value   : null)
    setItTickets(tickRes.status === 'fulfilled' && tickRes.value.ok ? tickRes.value.value : null)
    setPwResets(pwRes.status  === 'fulfilled' && pwRes.value.ok  ? pwRes.value.value  : null)

    // Surface a top-level error only when every single call fails
    if (allFailed) {
      setError('Cannot reach the backend. Showing demo data.')
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return {
    incidents,
    alerts,
    itTickets,
    pwResets,
    loading,
    error,
    backendOnline,
    refetch: fetchAll,
  }
}

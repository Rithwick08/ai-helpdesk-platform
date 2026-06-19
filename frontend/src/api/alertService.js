/**
 * alertService.js
 * All calls to the /alerts and /actions endpoints.
 *
 * Alert shape:
 *   { id, alert_name, alert_data, threat_type, severity,
 *     recommended_action, created_at }
 *
 * Action shape:
 *   { id, alert_id, incident_id, action_name,
 *     action_status, action_output }
 */

import apiClient from './apiClient'

/** Fetch all alerts */
export const getAlerts = () =>
  apiClient.get('/alerts').then((r) => r.data)

/** Create an alert (AI-analysed, may auto-create incident) */
export const createAlert = (payload) =>
  apiClient.post('/alerts', payload).then((r) => r.data)

/** Fetch all automated actions */
export const getActions = () =>
  apiClient.get('/actions').then((r) => r.data)

/** Fetch actions for a specific incident */
export const getActionsByIncident = (incidentId) =>
  apiClient.get(`/actions/${incidentId}`).then((r) => r.data)

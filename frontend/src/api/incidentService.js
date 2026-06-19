/**
 * incidentService.js
 * All calls to the /incidents endpoints.
 *
 * Incident shape returned by backend:
 *   { id, title, description, category, severity,
 *     confidence_score, status, created_at }
 */

import apiClient from './apiClient'

/** Fetch all incidents */
export const getIncidents = () =>
  apiClient.get('/incidents').then((r) => r.data)

/** Fetch a single incident by ID */
export const getIncident = (id) =>
  apiClient.get(`/incidents/${id}`).then((r) => r.data)

/** Create a new incident (AI-classified on backend) */
export const createIncident = (payload) =>
  apiClient.post('/incidents', payload).then((r) => r.data)

/** Update an incident's status */
export const updateIncidentStatus = (id, status) =>
  apiClient.put(`/incidents/${id}`, { status }).then((r) => r.data)

/** Delete an incident */
export const deleteIncident = (id) =>
  apiClient.delete(`/incidents/${id}`).then((r) => r.data)

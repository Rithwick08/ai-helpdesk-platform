/**
 * itTicketService.js
 * All calls to the /it-tickets and /ticket-history endpoints.
 *
 * IT Ticket shape:
 *   { id, title, description, category, priority,
 *     diagnosis, recommended_fix, resolution_steps,
 *     status, created_at }
 */

import apiClient from './apiClient'

/** Fetch all IT tickets */
export const getITTickets = () =>
  apiClient.get('/it-tickets').then((r) => r.data)

/** Create a new IT ticket (AI-diagnosed on backend) */
export const createITTicket = (payload) =>
  apiClient.post('/it-tickets', payload).then((r) => r.data)

/** Mark a ticket as resolved */
export const resolveTicket = (id) =>
  apiClient.put(`/it-tickets/${id}/resolve`).then((r) => r.data)

/** Escalate a ticket */
export const escalateTicket = (id) =>
  apiClient.put(`/it-tickets/${id}/escalate`).then((r) => r.data)

/** Submit user feedback (resolved: true/false) */
export const submitTicketFeedback = (id, resolved) =>
  apiClient.put(`/it-tickets/${id}/feedback`, { resolved }).then((r) => r.data)

/** Close a resolved ticket */
export const closeTicket = (id) =>
  apiClient.put(`/it-tickets/${id}/close`).then((r) => r.data)

/** Fetch history log for a ticket */
export const getTicketHistory = (id) =>
  apiClient.get(`/ticket-history/${id}`).then((r) => r.data)

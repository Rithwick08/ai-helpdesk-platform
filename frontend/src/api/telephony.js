/**
 * telephony.js — Frontend API helpers for the CyberShield AI voice telephony module.
 *
 * Uses the shared apiClient (Axios) which automatically attaches the JWT
 * Bearer token from localStorage.
 */

import apiClient from './apiClient'

/**
 * Request an outbound AI voice call to the authenticated employee's phone.
 *
 * @returns {Promise<{ success: boolean, call_sid?: string, status?: string, message: string }>}
 */
export async function requestOutboundCall() {
  const response = await apiClient.post('/telephony/outbound-call')
  return response.data
}

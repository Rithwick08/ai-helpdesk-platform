/**
 * passwordResetService.js
 * All calls to the /password-resets endpoints.
 *
 * PasswordReset shape:
 *   { id, employee_id, reason, otp, identity_verified,
 *     priority, action_taken, status, created_at }
 */

import apiClient from './apiClient'

/** Fetch all password reset requests */
export const getPasswordResets = () =>
  apiClient.get('/password-resets').then((r) => r.data)

/** Initiate a new password reset (returns OTP) */
export const createPasswordReset = (payload) =>
  apiClient.post('/password-resets', payload).then((r) => r.data)

/** Verify OTP for a reset request */
export const verifyOTP = (requestId, otp) =>
  apiClient
    .post('/password-resets/verify', { request_id: requestId, otp })
    .then((r) => r.data)

/** Admin-approve a verified reset request */
export const approvePasswordReset = (requestId) =>
  apiClient.put(`/password-resets/${requestId}/approve`).then((r) => r.data)

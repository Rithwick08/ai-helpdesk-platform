import apiClient from './apiClient'

export const getPasswordRequests = async () => {
  const response = await apiClient.get('/password-resets')
  return response.data
}

export const createPasswordReset = async (payload) => {
  const response = await apiClient.post('/password-resets', payload)
  return response.data
}

export const verifyOTP = async (requestId, otp) => {
  const response = await apiClient.post('/password-resets/verify', { request_id: requestId, otp })
  return response.data
}

export const approvePasswordRequest = async (id) => {
  const response = await apiClient.put(`/password-resets/${id}/approve`)
  return response.data
}

export const updatePasswordRequest = async (id, data) => {
  const response = await apiClient.put(`/password-resets/${id}`, data)
  return response.data
}

export const deletePasswordRequest = async (id) => {
  const response = await apiClient.delete(`/password-resets/${id}`)
  return response.data
}

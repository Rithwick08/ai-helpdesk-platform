import apiClient from './apiClient'

export async function getSecurityUpdates() {
  const { data } = await apiClient.get('/security-updates')
  return data
}

export async function createSecurityUpdate(updateData) {
  const { data } = await apiClient.post('/security-updates', updateData)
  return data
}

export async function updateSecurityUpdate(id, updateData) {
  const { data } = await apiClient.put(`/security-updates/${id}`, updateData)
  return data
}

export async function deleteSecurityUpdate(id) {
  const { data } = await apiClient.delete(`/security-updates/${id}`)
  return data
}

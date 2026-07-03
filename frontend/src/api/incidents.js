import apiClient from './apiClient'

export const getIncidents = async () => {
  const response = await apiClient.get('/incidents')
  return response.data
}

export const createIncident = async (incidentData) => {
  const response = await apiClient.post('/incidents', incidentData)
  return response.data
}

export const updateIncident = async (id, statusData) => {
  const response = await apiClient.put(`/incidents/${id}`, statusData)
  return response.data
}

export const deleteIncident = async (id) => {
  const response = await apiClient.delete(`/incidents/${id}`)
  return response.data
}

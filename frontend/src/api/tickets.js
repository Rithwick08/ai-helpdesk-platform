import apiClient from './apiClient'

export const getTickets = async () => {
  const response = await apiClient.get('/it-tickets')
  return response.data
}

export const getTicketHistory = async (id) => {
  const response = await apiClient.get(`/ticket-history/${id}`)
  return response.data
}

export const resolveTicket = async (id) => {
  const response = await apiClient.put(`/it-tickets/${id}/resolve`)
  return response.data
}

export const escalateTicket = async (id) => {
  const response = await apiClient.put(`/it-tickets/${id}/escalate`)
  return response.data
}

export const closeTicket = async (id) => {
  const response = await apiClient.put(`/it-tickets/${id}/close`)
  return response.data
}

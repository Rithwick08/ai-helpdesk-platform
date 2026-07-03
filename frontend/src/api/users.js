import apiClient from './apiClient'

export const getUsers = async () => {
  const response = await apiClient.get('/users')
  return response.data
}

export const createUser = async (userData) => {
  const response = await apiClient.post('/users', userData)
  return response.data
}

export const updateUser = async (id, userData) => {
  const response = await apiClient.put(`/users/${id}`, userData)
  return response.data
}

export const deleteUser = async (id) => {
  const response = await apiClient.delete(`/users/${id}`)
  return response.data
}

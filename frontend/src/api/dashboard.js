import apiClient from './apiClient'

export const getDashboardSummary = async () => {
  const response = await apiClient.get('/dashboard/summary')
  return response.data
}

export const getDashboardActivity = async () => {
  const response = await apiClient.get('/dashboard/activity')
  return response.data
}

export const getDashboardCharts = async () => {
  const response = await apiClient.get('/dashboard/charts')
  return response.data
}

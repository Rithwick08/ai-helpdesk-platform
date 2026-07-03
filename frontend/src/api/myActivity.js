import apiClient from './apiClient'

export async function getMyActivity() {
  const { data } = await apiClient.get('/my-activity')
  return data
}

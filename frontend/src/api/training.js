import apiClient from './apiClient'

export async function getTrainingVideos() {
  const { data } = await apiClient.get('/training-videos')
  return data
}

export async function createTrainingVideo(videoData) {
  const { data } = await apiClient.post('/training-videos', videoData)
  return data
}

export async function updateTrainingVideo(id, videoData) {
  const { data } = await apiClient.put(`/training-videos/${id}`, videoData)
  return data
}

export async function deleteTrainingVideo(id) {
  const { data } = await apiClient.delete(`/training-videos/${id}`)
  return data
}

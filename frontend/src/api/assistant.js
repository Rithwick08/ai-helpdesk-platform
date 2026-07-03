import apiClient from './apiClient'

export async function chatAssistant(conversationId, message) {
  const { data } = await apiClient.post('/assistant/chat', {
    conversation_id: conversationId,
    message: message
  })
  return data
}

/**
 * Transcribe an audio Blob using the server-side Whisper endpoint.
 * Returns { transcript: string } on success,
 * or      { transcript: null, error: string } on failure.
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')

  const { data } = await apiClient.post('/assistant/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

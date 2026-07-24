import apiClient from './apiClient'

export async function chatAssistant(conversationId, message) {
  const { data } = await apiClient.post('/assistant/chat', {
    conversation_id: conversationId,
    message: message
  })
  return data
}

/**
 * Send an audio Blob to the Deepgram STT -> CyberShield AI -> Sarvam TTS pipeline (POST /voice/chat).
 * Supports multi-turn conversations, JWT auth, workflow memory, and returns audio + metadata.
 *
 * @param {Blob} audioBlob
 * @param {number|null} conversationId
 * @param {string|null} sessionId
 * @returns {Promise<{
 *   transcript: string,
 *   response_text: string,
 *   conversation_id: number,
 *   agent_status: string,
 *   session_id: string,
 *   audio_url: string,
 *   audio_blob: Blob
 * }>}
 */
export async function sendVoiceChat(audioBlob, conversationId = null, sessionId = null) {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  if (conversationId) formData.append('conversation_id', conversationId)
  if (sessionId) formData.append('session_id', sessionId)

  const response = await apiClient.post('/voice/chat', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  })

  const getHeader = (name) => {
    const val = response.headers[name.toLowerCase()] || response.headers[name]
    return val ? decodeURIComponent(val) : null
  }

  const transcript = getHeader('x-transcript') || ''
  const responseText = getHeader('x-response-text') || ''
  const convIdStr = getHeader('x-conversation-id')
  const returnedConvId = convIdStr ? parseInt(convIdStr, 10) : conversationId
  const agentStatus = getHeader('x-agent-status') || 'chat'
  const returnedSessionId = getHeader('x-session-id') || sessionId

  const audioUrl = URL.createObjectURL(response.data)

  return {
    transcript,
    response_text: responseText,
    conversation_id: returnedConvId,
    agent_status: agentStatus,
    session_id: returnedSessionId,
    audio_url: audioUrl,
    audio_blob: response.data,
  }
}

/**
 * Legacy compatibility helper for STT only.
 */
export async function transcribeAudio(audioBlob) {
  const res = await sendVoiceChat(audioBlob)
  return { transcript: res.transcript }
}

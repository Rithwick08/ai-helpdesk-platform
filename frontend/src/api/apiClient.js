/**
 * apiClient.js
 * Pre-configured Axios instance for all requests to the FastAPI backend.
 *
 * - Base URL pulled from VITE_API_BASE_URL (.env)
 * - 10-second timeout on all requests
 * - Request interceptor: attach auth token when present (ready for JWT)
 * - Response interceptor: normalise error shape before throwing
 */

import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ── Request interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Attach Bearer token if one is stored (ready for auth implementation)
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalise the error so callers always get { message, status, originalError }
    const normalised = {
      message:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'An unknown error occurred',
      status: error.response?.status ?? null,
      originalError: error,
    }

    // 401 → could redirect to login in the future
    if (normalised.status === 401) {
      console.warn('[apiClient] Unauthorised — token may be expired')
    }

    return Promise.reject(normalised)
  },
)

export default apiClient

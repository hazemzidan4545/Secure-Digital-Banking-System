import axios from 'axios'

function resolveApiBaseUrl() {
  try {
    // Keep Vite runtime support without hard-requiring import.meta during Jest parsing.
    return new Function('return (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || ""')()
  } catch {
    return ''
  }
}

export function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop().split(';').shift()
  }
  return null
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
})

api.interceptors.request.use((request) => {
  const method = String(request.method || 'get').toUpperCase()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCookie('csrf_token')
    if (csrfToken) {
      request.headers['x-csrf-token'] = csrfToken
    }
  }
  return request
})

export async function apiFetch(path, options = {}) {
  try {
    const response = await api.request({
      url: path,
      method: options.method || 'GET',
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      responseType: options.responseType,
    })
    return response.data
  } catch (error) {
    const message = error?.response?.data?.error || error?.response?.data?.message || 'Request failed.'
    throw new Error(message)
  }
}

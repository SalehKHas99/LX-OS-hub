import axios from 'axios'

// Use env in build so production can point to a different API origin; dev uses relative URL + Vite proxy
const baseURL =
  typeof import.meta.env.VITE_API_BASE_URL === 'string' && import.meta.env.VITE_API_BASE_URL.length > 0
    ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api/v1`
    : '/api/v1'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000, // 30s for long-running (e.g. lab, uploads)
})

function getAccessToken(): string | null {
  return localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
}
function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token') ?? sessionStorage.getItem('refresh_token')
}
function setTokens(access: string, refresh: string): void {
  if (localStorage.getItem('refresh_token')) {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  } else {
    sessionStorage.setItem('access_token', access)
    sessionStorage.setItem('refresh_token', refresh)
  }
}
function clearTokens(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  sessionStorage.removeItem('access_token')
  sessionStorage.removeItem('refresh_token')
}

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = getRefreshToken()
      if (refresh) {
        try {
          const { data } = await api.post('/auth/refresh', { refresh_token: refresh })
          setTokens(data.access_token, data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          clearTokens()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api

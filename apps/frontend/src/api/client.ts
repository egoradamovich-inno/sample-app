import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

// `withCredentials` makes the browser attach the httpOnly access_token/refresh_token
// (or impersonation_access_token/impersonation_refresh_token) cookies automatically on
// same-site requests — the backend's JwtAuthGuard reads the session from those cookies
// first, so there's no client-readable token to attach via a request interceptor anymore.
export const apiClient = axios.create({ baseURL: BASE_URL, withCredentials: true })

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

// Concurrent 401s share one in-flight refresh instead of each firing its own —
// still exactly one refresh call per failing request either way.
let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  try {
    // Goes through `apiClient` (not a bare `axios.post`) so tests can stub one adapter
    // for both the protected call and the refresh call. The response interceptor below
    // excludes `/auth/refresh` from triggering another refresh, so this can't recurse.
    // No body needed — the refresh_token/impersonation_refresh_token cookie rides along
    // automatically and the server sets fresh cookies on success.
    await apiClient.post('/auth/refresh')
    return true
  } catch {
    return false
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh') ?? false

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried && !isRefreshCall) {
      originalRequest._retried = true

      if (refreshPromise === null) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null
        })
      }
      const refreshed = await refreshPromise

      if (refreshed) {
        // The refreshed cookies ride along automatically — just replay the original request.
        return apiClient(originalRequest)
      }
    }

    return Promise.reject(error)
  },
)

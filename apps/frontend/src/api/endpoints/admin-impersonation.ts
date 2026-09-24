import { apiClient } from '../client'
import type { UserSummary } from '../../types/api'

export interface ImpersonationStartResponse {
  impersonatedUser: UserSummary
  startedAt: string
  // Vestigial: the backend's dual-cookie handoff (ADR-0006) sets a second,
  // independent `impersonation_access_token`/`impersonation_refresh_token` cookie
  // pair as the real mechanism — these body fields are kept only for API-contract
  // backward compatibility. The frontend never reads them; after `start()` resolves,
  // `AuthContext.refetchMe()` re-derives identity from `GET /auth/me` instead.
  accessToken: string
  refreshToken: string
}

export interface ImpersonationLogEntry {
  adminName: string
  targetName: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

export interface ImpersonationHistoryResponse {
  items: ImpersonationLogEntry[]
  total: number
  page: number
  pageSize: number
}

export const adminImpersonationApi = {
  start: (userId: string): Promise<ImpersonationStartResponse> =>
    apiClient.post<ImpersonationStartResponse>(`/admin/impersonation/${userId}/start`).then((res) => res.data),

  exit: (): Promise<void> => apiClient.post<void>('/admin/impersonation/exit').then((res) => res.data),

  history: (params: { page?: number; pageSize?: number } = {}): Promise<ImpersonationHistoryResponse> =>
    apiClient
      .get<ImpersonationHistoryResponse>('/admin/impersonation/history', { params })
      .then((res) => res.data),
}

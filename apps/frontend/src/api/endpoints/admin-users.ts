import { apiClient } from '../client'
import type { PaginatedResponse, Role, UserStatus, UserSummary } from '../../types/api'

export interface CreateTrainerPayload {
  businessName: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

export interface EditUserPayload {
  businessName?: string
  firstName?: string
  lastName?: string
  phone?: string
}

export interface ListUsersParams {
  page?: number
  pageSize?: number
  search?: string
  role?: Role
  status?: UserStatus
}

export const adminUsersApi = {
  list: (params: ListUsersParams = {}): Promise<PaginatedResponse<UserSummary>> =>
    apiClient.get<PaginatedResponse<UserSummary>>('/admin/users', { params }).then((res) => res.data),

  create: (payload: CreateTrainerPayload): Promise<UserSummary> =>
    apiClient.post<UserSummary>('/admin/users', payload).then((res) => res.data),

  edit: (id: string, payload: EditUserPayload): Promise<UserSummary> =>
    apiClient.patch<UserSummary>(`/admin/users/${id}`, payload).then((res) => res.data),

  deactivate: (id: string): Promise<UserSummary> =>
    apiClient.post<UserSummary>(`/admin/users/${id}/deactivate`).then((res) => res.data),

  reactivate: (id: string): Promise<UserSummary> =>
    apiClient.post<UserSummary>(`/admin/users/${id}/reactivate`).then((res) => res.data),

  remove: (id: string, reason?: string): Promise<UserSummary> =>
    apiClient.post<UserSummary>(`/admin/users/${id}/delete`, { reason }).then((res) => res.data),
}

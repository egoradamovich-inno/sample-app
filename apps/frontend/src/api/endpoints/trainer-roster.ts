import { apiClient } from '../client'
import type { PaginatedResponse } from '../../types/api'

export interface RosterMember {
  id: string
  name: string
  role: 'PLAYER' | 'COACH'
  availabilitySummary: string
}

export const trainerRosterApi = {
  list: (params: { page?: number; pageSize?: number } = {}): Promise<PaginatedResponse<RosterMember>> =>
    apiClient.get<PaginatedResponse<RosterMember>>('/trainer/roster', { params }).then((res) => res.data),

  filterByAvailability: (dayOfWeek: number, time: string): Promise<RosterMember[]> =>
    apiClient
      .get<RosterMember[]>('/trainer/players/availability', { params: { dayOfWeek, time } })
      .then((res) => res.data),
}

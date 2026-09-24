import { apiClient } from '../client'

export interface CoachProfile {
  bio?: string | null
  credentials?: string | null
  certifications: string[]
  publicVisible: boolean
  publicSlug?: string | null
}

export interface PublicCoachProfile {
  name: string
  bio?: string | null
  credentials?: string | null
  certifications: string[]
}

export interface ConflictCheckPayload {
  eventId?: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface OverrideConflictPayload extends ConflictCheckPayload {
  reason: string
}

export const coachApi = {
  updateProfile: (payload: Partial<CoachProfile>): Promise<CoachProfile> =>
    apiClient.put<CoachProfile>('/coach/profile', payload).then((res) => res.data),

  // Returns a uniform 404 for not-found / not-public / deactivated per the API's
  // anti-enumeration contract — callers must not try to distinguish the cause.
  getPublicProfile: (slug: string): Promise<PublicCoachProfile> =>
    apiClient.get<PublicCoachProfile>(`/coach/public/${slug}`).then((res) => res.data),

  checkConflict: (coachId: string, payload: ConflictCheckPayload): Promise<{ conflict: boolean }> =>
    apiClient.post<{ conflict: boolean }>(`/coach/${coachId}/conflict-check`, payload).then((res) => res.data),

  recordOverride: (coachId: string, payload: OverrideConflictPayload): Promise<void> =>
    apiClient.post<void>(`/coach/${coachId}/override`, payload).then((res) => res.data),
}

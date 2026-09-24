import { apiClient } from '../client'
import type { ShareLinkType } from '../../types/api'

export interface StaticLinkResponse {
  code: string
  url: string
}

export interface CoachInviteResponse {
  code: string
  url: string
  expiresAt: string
  targetEmail: string
}

export interface CoachInvitePayload {
  targetEmail: string
  message?: string
}

export type CoachInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED'

export interface CoachInviteListItem {
  id: string
  targetEmail: string
  status: CoachInviteStatus
  createdAt: string
  expiresAt: string
}

export interface JoinLinkFamilyMember {
  id: string
  name: string
  age?: number
}

export interface JoinLinkInfo {
  trainerName: string
  linkType: ShareLinkType
  blocked?: boolean
  familySelectionNeeded?: boolean
  familyMembers?: JoinLinkFamilyMember[]
}

/**
 * Serves two distinct call shapes on the same `POST /join/:code/register` endpoint, matching
 * `RegisterViaLinkDto` on the backend (`modules/sharelink/dto/register-via-link.dto.ts`): a
 * brand-new anonymous registrant fills email/password/firstName/lastName; an already-logged-in
 * caller doing family-member selection sends only `associateMemberIds` — the backend resolves
 * which branch applies from whether a valid access token was presented, not from which fields
 * are populated here. All fields are therefore optional at this layer.
 */
export interface RegisterViaLinkPayload {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  phone?: string
  associateMemberIds?: string[]
}

export interface RegisterViaLinkResponse {
  accessToken: string
  refreshToken: string
}

export const sharelinksApi = {
  generateStatic: (): Promise<StaticLinkResponse> =>
    apiClient.post<StaticLinkResponse>('/sharelinks/static').then((res) => res.data),

  generateCoachInvite: (payload: CoachInvitePayload): Promise<CoachInviteResponse> =>
    apiClient.post<CoachInviteResponse>('/sharelinks/coach-invite', payload).then((res) => res.data),

  // Not itemized in api-designer-spec.md (which specs generation but not listing) —
  // inferred to back CoachInvitationStatusList's Pending/Accepted/Expired ledger.
  listCoachInvites: (): Promise<CoachInviteListItem[]> =>
    apiClient.get<CoachInviteListItem[]>('/sharelinks/coach-invites').then((res) => res.data),

  resendCoachInvite: (id: string): Promise<CoachInviteResponse> =>
    apiClient.post<CoachInviteResponse>(`/sharelinks/coach-invite/${id}/resend`).then((res) => res.data),

  resolve: (code: string): Promise<JoinLinkInfo> =>
    apiClient.get<JoinLinkInfo>(`/join/${code}`).then((res) => res.data),

  registerViaLink: (code: string, payload: RegisterViaLinkPayload): Promise<RegisterViaLinkResponse> =>
    apiClient.post<RegisterViaLinkResponse>(`/join/${code}/register`, payload).then((res) => res.data),
}

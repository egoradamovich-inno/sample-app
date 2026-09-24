import { apiClient } from '../client'

export interface TrainerAssociationSummary {
  trainerId: string
  trainerName: string
  status: string
}

export interface PlayerProfileSummary {
  id: string
  displayName: string
  birthDate: string | null
  isChild: boolean
  trainerAssociations: TrainerAssociationSummary[]
}

export interface CreateChildProfilePayload {
  displayName: string
  birthDate: string
  gender: string
  school?: string
  associateTrainerIds?: string[]
}

export interface CreateChildProfileResponse extends PlayerProfileSummary {
  duplicateWarning?: boolean
  trainerSelectionPrompt?: 'single' | 'multi' | null
}

export interface AddTrainerAssociationPayload {
  shareLinkCode?: string
  trainerId?: string
}

export const playerProfilesApi = {
  list: (): Promise<PlayerProfileSummary[]> => apiClient.get<PlayerProfileSummary[]>('/players').then((res) => res.data),

  createChild: (payload: CreateChildProfilePayload): Promise<CreateChildProfileResponse> =>
    apiClient.post<CreateChildProfileResponse>('/players/child', payload).then((res) => res.data),

  addTrainerAssociation: (
    playerId: string,
    payload: AddTrainerAssociationPayload,
  ): Promise<PlayerProfileSummary> =>
    apiClient.post<PlayerProfileSummary>(`/players/${playerId}/trainers`, payload).then((res) => res.data),

  removeTrainerAssociation: (playerId: string, trainerId: string): Promise<{ cancelledUpcomingRsvps: true }> =>
    apiClient
      .delete<{ cancelledUpcomingRsvps: true }>(`/players/${playerId}/trainers/${trainerId}`)
      .then((res) => res.data),
}

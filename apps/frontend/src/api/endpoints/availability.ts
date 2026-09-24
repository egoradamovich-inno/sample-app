import { apiClient } from '../client'

export interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable?: boolean
}

export interface SetAvailabilityPayload {
  ownerProfileId?: string
  slots: AvailabilitySlot[]
}

export const availabilityApi = {
  // `ownerProfileId` on the GET isn't itemized in api-designer-spec.md (only the PUT
  // documents it) — inferred as the read-side symmetric counterpart so a parent can
  // load a child's current grid before editing it, not just blind-submit a new one.
  getMine: (ownerProfileId?: string): Promise<AvailabilitySlot[]> =>
    apiClient.get<AvailabilitySlot[]>('/availability/me', { params: ownerProfileId ? { ownerProfileId } : undefined }).then((res) => res.data),

  setMine: (payload: SetAvailabilityPayload): Promise<AvailabilitySlot[]> =>
    apiClient.put<AvailabilitySlot[]>('/availability/me', payload).then((res) => res.data),

  getForPlayer: (playerId: string): Promise<AvailabilitySlot[]> =>
    apiClient.get<AvailabilitySlot[]>(`/availability/player/${playerId}`).then((res) => res.data),
}

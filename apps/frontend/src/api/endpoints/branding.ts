import { apiClient } from '../client'

export interface Branding {
  logoUrl: string | null
  primaryColorHex: string | null
}

export const brandingApi = {
  // `trainerId` isn't itemized in api-designer-spec.md (GET /trainer/branding derives
  // the trainer from the caller's own JWT for trainer/coach users) — inferred as an
  // optional override so a multi-trainer PLAYER can fetch the ACTIVE ContextSwitcher
  // trainer's branding specifically, never one resolved ambiguously server-side.
  get: (trainerId?: string): Promise<Branding> =>
    apiClient.get<Branding>('/trainer/branding', { params: trainerId ? { trainerId } : undefined }).then((res) => res.data),

  update: (payload: { primaryColorHex?: string }): Promise<Branding> =>
    apiClient.put<Branding>('/trainer/branding', payload).then((res) => res.data),

  uploadLogo: (file: File): Promise<Branding> => {
    const formData = new FormData()
    formData.append('logo', file)
    return apiClient
      .post<Branding>('/trainer/branding/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data)
  },
}

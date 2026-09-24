import { apiClient } from '../client'
import type { Role, UserStatus } from '../../types/api'

export interface Profile {
  id: string
  email: string
  role: Role
  status: UserStatus
  createdAt: string
  firstName: string
  lastName: string
  phone?: string | null
  photoUrl?: string | null
  school?: string | null
  skillLevel?: string | null
  bio?: string | null
  credentials?: string | null
  certifications?: string[]
  publicVisible?: boolean
  jerseyNumber?: string | null
  emergencyContact?: string | null
  businessName?: string | null
  address?: string | null
  website?: string | null
  description?: string | null
}

export interface UpdateProfilePayload {
  firstName?: string
  lastName?: string
  phone?: string
  school?: string
  bio?: string
  jerseyNumber?: string
  emergencyContact?: string
  credentials?: string
  certifications?: string[]
  publicVisible?: boolean
  businessName?: string
  address?: string
  website?: string
  description?: string
}

export const profileApi = {
  getOwn: (): Promise<Profile> => apiClient.get<Profile>('/profile/me').then((res) => res.data),

  updateOwn: (payload: UpdateProfilePayload): Promise<Profile> =>
    apiClient.patch<Profile>('/profile/me', payload).then((res) => res.data),

  uploadPhoto: (file: File): Promise<Profile> => {
    const formData = new FormData()
    formData.append('photo', file)
    return apiClient
      .post<Profile>('/profile/me/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data)
  },
}

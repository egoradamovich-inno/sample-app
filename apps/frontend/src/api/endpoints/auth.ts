import { apiClient } from '../client'
import type { AuthenticatedUser } from '../../types/api'

/** Matches `CreateChildProfileDto`'s field names (`modules/player-profile/dto/create-child-profile.dto.ts`)
 * for consistency with the rest of the system's child-profile shape, even though the backend's
 * current `RegisterDto` doesn't yet whitelist a nested `child` object — this models the design
 * spec's "register my child too" intent so the field is ready the moment the backend contract
 * catches up, rather than inventing an unrelated shape now and renaming later. */
export interface RegisterChildPayload {
  displayName: string
  birthDate: string
  gender: string
}

export interface RegisterPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  shareLinkCode?: string
  child?: RegisterChildPayload
}

export interface RegisterResponse {
  id: string
  email: string
  emailVerified: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export const authApi = {
  // Deliberately does NOT return tokens — email verification is required
  // before login, so this can never be used to establish a session.
  register: (payload: RegisterPayload): Promise<RegisterResponse> =>
    apiClient.post<RegisterResponse>('/auth/register', payload).then((res) => res.data),

  // The response body still carries `accessToken`/`refreshToken`/`user` for API-contract
  // backward compatibility (non-browser clients), but the httpOnly access_token/refresh_token
  // cookies set alongside it are the real session mechanism now — callers should follow up
  // with `authApi.me()` (via `AuthContext.refetchMe`) rather than reading this response body.
  login: (payload: LoginPayload): Promise<void> =>
    apiClient.post('/auth/login', payload).then(() => undefined),

  // The one place the server exposes the JWT payload back to the browser as plain JSON —
  // cookies are httpOnly, so nothing client-side decodes a token anymore.
  me: (): Promise<AuthenticatedUser> => apiClient.get<AuthenticatedUser>('/auth/me').then((res) => res.data),

  // No refresh token needed — the refresh_token/impersonation_refresh_token cookie carries it.
  logout: (): Promise<void> => apiClient.post<void>('/auth/logout').then((res) => res.data),

  verifyEmail: (token: string): Promise<void> =>
    apiClient.post<void>('/auth/verify-email', { token }).then((res) => res.data),

  requestPasswordReset: (email: string): Promise<{ message: string }> =>
    apiClient.post<{ message: string }>('/auth/password-reset/request', { email }).then((res) => res.data),

  confirmPasswordReset: (token: string, newPassword: string): Promise<void> =>
    apiClient.post<void>('/auth/password-reset/confirm', { token, newPassword }).then((res) => res.data),

  // Not itemized in api-designer-spec.md's endpoint catalog, but required by
  // frontend-design-spec.md's LoginPage "resend verification email" recovery action
  // for EMAIL_NOT_VERIFIED — inferred as the natural counterpart to /auth/verify-email.
  resendVerification: (email: string): Promise<void> =>
    apiClient.post<void>('/auth/resend-verification', { email }).then((res) => res.data),
}

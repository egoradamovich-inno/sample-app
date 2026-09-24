// Shared API types for TASK-008 (Epic-01 User Management & Authentication).
// Frontend tsconfig has `erasableSyntaxOnly` set, so `enum` is not usable here —
// string literal union types stand in for the backend's Prisma enums.

export type Role = 'SUPER_ADMIN' | 'TRAINER' | 'COACH' | 'PLAYER'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED'
export type PaymentType = 'USD' | 'TOKEN'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'
export type ShareLinkType = 'STATIC' | 'UNIQUE'

export interface UserSummary {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  lastLoginAt: string | null
}

/** Shape of `GET /auth/me` — the authenticated caller's identity derived
 * server-side from the validated JWT (cookie- or header-authenticated).
 * This is the one place the frontend gets the decoded token payload back as
 * plain JSON; with httpOnly session cookies the token itself is never
 * JS-readable, so nothing client-side decodes a JWT anymore. */
export interface AuthenticatedUser {
  userId: string
  email: string
  role: Role
  parentUserId: string | null
  /** Set only while an admin is actively impersonating this session — the
   * admin's own userId, not a name. */
  impersonatedBy?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiErrorBody {
  statusCode: number
  message: string
  errorCode: string
  details?: Record<string, unknown>
}

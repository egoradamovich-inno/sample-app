import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../types/api'

// No separate "dashboard home" concept (frontend-design-spec.md) — each role lands
// directly on its own first substantive page.
const ROLE_HOME_PATH: Record<Role, string> = {
  SUPER_ADMIN: '/admin/users',
  TRAINER: '/trainer/roster',
  COACH: '/coach/my-times',
  PLAYER: '/players',
}

export function RoleDashboardRedirect() {
  const { user } = useAuth()

  if (user === null) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={ROLE_HOME_PATH[user.role]} replace />
}

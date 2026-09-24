import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** Gate for every authenticated-only route tree. Auth state is resolved
 * asynchronously now (a cookie-backed `GET /auth/me` check) rather than a
 * synchronous localStorage read, so this renders nothing while that initial
 * check is still in flight — treating "not yet known" as "signed out" would
 * bounce a perfectly valid session to /login on every hard refresh. Once
 * settled, redirects unauthenticated visits to /login, preserving the
 * intended destination in location state for post-login redirect. */
export function PrivateRoute() {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return null
  }

  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

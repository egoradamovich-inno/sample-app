import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { BrandingProvider } from './BrandingProvider'

/** Persistent shell every authenticated route mounts inside — resolves the active
 * trainer's branding first (BrandingProvider), then renders the role-aware
 * AppHeader above whatever page is routed via `Outlet`. Nested one level inside
 * `PrivateRoute` so the header/branding never mount for unauthenticated routes
 * (login, register, the public coach profile page, etc). */
export function AppShell() {
  return (
    <BrandingProvider>
      <AppHeader />
      <Outlet />
    </BrandingProvider>
  )
}

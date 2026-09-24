import { Link } from 'react-router-dom'
import { ImpersonationBanner } from '../pages/admin/ImpersonationBanner'
import { useAuth } from '../auth/AuthContext'
import { ContextSwitcher } from '../nav/ContextSwitcher'
import { useBranding } from './BrandingProvider'

const NAV_LINKS_BY_ROLE: Record<string, { to: string; label: string }[]> = {
  SUPER_ADMIN: [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/impersonation/history', label: 'Impersonation History' },
  ],
  TRAINER: [
    { to: '/trainer/roster', label: 'Roster' },
    { to: '/trainer/branding', label: 'Branding' },
  ],
  COACH: [{ to: '/coach/my-times', label: 'My Times' }],
  PLAYER: [
    { to: '/players', label: 'Family' },
    { to: '/players/approvals', label: 'Approvals' },
    { to: '/players/best-times', label: 'Best Times' },
  ],
}

/** The persistent app shell every authenticated page mounts inside. */
export function AppHeader() {
  const { user, logout } = useAuth()
  const { branding } = useBranding()
  const navLinks = user !== null ? (NAV_LINKS_BY_ROLE[user.role] ?? []) : []

  return (
    <>
      <ImpersonationBanner />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule-strong bg-paper-raised px-4 py-3">
        <div className="flex items-center gap-3">
          {branding?.logoUrl !== null && branding?.logoUrl !== undefined && (
            <img src={branding.logoUrl} alt="" className="h-8 w-8 rounded-sm object-contain" />
          )}
          <span className="font-display text-lg uppercase tracking-tight text-ink">Training Platform</span>
        </div>

        <nav className="flex flex-wrap items-center gap-4">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className="text-body text-ink hover:text-cinder">
              {link.label}
            </Link>
          ))}
          <Link to="/profile" className="text-body text-ink hover:text-cinder">
            Profile
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ContextSwitcher />
          <button type="button" onClick={() => void logout()} className="text-body text-ink-soft underline">
            Log out
          </button>
        </div>
      </header>
    </>
  )
}

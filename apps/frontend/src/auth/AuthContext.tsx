import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { adminImpersonationApi } from '../api/endpoints/admin-impersonation'
import { authApi } from '../api/endpoints/auth'
import type { AuthenticatedUser } from '../types/api'

interface AuthContextValue {
  user: AuthenticatedUser | null
  isAuthenticated: boolean
  isImpersonating: boolean
  /** True when the active session belongs to a child's own login (a real,
   * second `User` row with `parentUserId` set) — drives ContextSwitcher's child
   * variant (flat trainer list, no "Me" section) per FR-026. */
  isChildAccount: boolean
  /** True only while the very first `GET /auth/me` (on mount) is still in flight.
   * Auth state is asynchronous now — a cookie-backed session check — rather than a
   * synchronous localStorage read, so consumers like PrivateRoute must not treat
   * `user === null` as "signed out" until this settles. */
  isInitializing: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-fetches `GET /auth/me` and syncs context state from it. `login`/`logout`/
   * impersonation start/exit all call this afterward instead of manually
   * constructing user state from a response body or a decoded token. */
  refetchMe: () => Promise<AuthenticatedUser | null>
  startImpersonation: (userId: string) => Promise<void>
  exitImpersonation: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const refetchMe = useCallback(async (): Promise<AuthenticatedUser | null> => {
    try {
      const me = await authApi.me()
      setUser(me)
      return me
    } catch {
      // 401 (no valid session) — or any other failure — leaves the caller signed
      // out rather than holding on to stale state.
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void refetchMe().finally(() => {
      if (!cancelled) {
        setIsInitializing(false)
      }
    })
    return () => {
      cancelled = true
    }
    // Runs exactly once on mount — refetchMe has no reactive deps of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      await authApi.login({ email, password })
      await refetchMe()
    },
    [refetchMe],
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const startImpersonation = useCallback(
    async (userId: string): Promise<void> => {
      await adminImpersonationApi.start(userId)
      await refetchMe()
    },
    [refetchMe],
  )

  const exitImpersonation = useCallback(async (): Promise<void> => {
    await adminImpersonationApi.exit()
    await refetchMe()
  }, [refetchMe])

  const isImpersonating = user?.impersonatedBy !== undefined
  const isChildAccount = user !== null && user.parentUserId !== null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isImpersonating,
      isChildAccount,
      isInitializing,
      login,
      logout,
      refetchMe,
      startImpersonation,
      exitImpersonation,
    }),
    [user, isImpersonating, isChildAccount, isInitializing, login, logout, refetchMe, startImpersonation, exitImpersonation],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

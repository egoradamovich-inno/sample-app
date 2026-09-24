import { createContext, useContext, useMemo, useState } from 'react'
import type { JSX, ReactNode } from 'react'

export interface ActiveContextSelection {
  memberId: string
  memberName: string
  trainerId: string
  trainerName: string
}

interface ActiveContextValue {
  selection: ActiveContextSelection | null
  setSelection: (selection: ActiveContextSelection) => void
}

const ActiveContextContext = createContext<ActiveContextValue | null>(null)

/** Tracks which family member + trainer the switcher is currently pointed at, so
 * BestTimesPage and BrandingProvider read one shared source instead of each
 * duplicating a picker. Never shared across trainers — switching context replaces
 * the whole selection object, it never merges partial state from the old one. */
export function ActiveContextProvider({ children }: { children: ReactNode }): JSX.Element {
  const [selection, setSelection] = useState<ActiveContextSelection | null>(null)

  const value = useMemo<ActiveContextValue>(() => ({ selection, setSelection }), [selection])

  return <ActiveContextContext.Provider value={value}>{children}</ActiveContextContext.Provider>
}

export function useActiveContext(): ActiveContextValue {
  const context = useContext(ActiveContextContext)
  if (context === null) {
    throw new Error('useActiveContext must be used within an ActiveContextProvider')
  }
  return context
}

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { brandingApi } from '../api/endpoints/branding'
import { ActiveContextProvider, useActiveContext } from '../nav/ActiveContextContext'
import { BrandingProvider, useBranding } from './BrandingProvider'

vi.mock('../api/endpoints/branding', () => ({
  brandingApi: { get: vi.fn(), update: vi.fn(), uploadLogo: vi.fn() },
}))

function Consumer() {
  const { branding } = useBranding()
  return <span data-testid="cinder">{branding?.primaryColorHex ?? 'none'}</span>
}

function SwitchButton() {
  const { setSelection } = useActiveContext()
  return (
    <button
      onClick={() => setSelection({ memberId: 'child-1', memberName: 'Kid One', trainerId: 'trainer-2', trainerName: 'Beta' })}
    >
      switch-to-trainer-2
    </button>
  )
}

describe('BrandingProvider', () => {
  it('should fetch branding for the caller when there is no active multi-trainer selection', async () => {
    vi.mocked(brandingApi.get).mockResolvedValue({ logoUrl: null, primaryColorHex: '#111111' })

    render(
      <ActiveContextProvider>
        <BrandingProvider>
          <Consumer />
        </BrandingProvider>
      </ActiveContextProvider>,
    )

    await waitFor(() => expect(brandingApi.get).toHaveBeenCalledWith(undefined))
    expect(await screen.findByText('#111111')).toBeInTheDocument()
  })

  it("should re-fetch and never leak the previous trainer's color when the active context switches", async () => {
    // A mutable holder, not a plain reassigned `let` — TS's flow narrowing of a
    // `let` reassigned only inside a nested closure loses the reassignment and
    // narrows the later `?.()` call site back to the initial `null`, typing it as
    // `never`. An object property sidesteps that narrowing entirely.
    const resolveSecondFetchHolder: { current: ((value: { logoUrl: string | null; primaryColorHex: string }) => void) | null } = {
      current: null,
    }
    vi.mocked(brandingApi.get).mockImplementation((trainerId?: string) => {
      if (trainerId === undefined) {
        return Promise.resolve({ logoUrl: null, primaryColorHex: '#111111' })
      }
      return new Promise((resolve) => {
        resolveSecondFetchHolder.current = resolve
      })
    })

    const user = userEvent.setup()
    render(
      <ActiveContextProvider>
        <BrandingProvider>
          <SwitchButton />
          <Consumer />
        </BrandingProvider>
      </ActiveContextProvider>,
    )

    expect(await screen.findByText('#111111')).toBeInTheDocument()

    await user.click(screen.getByText('switch-to-trainer-2'))

    // While trainer-2's fetch is still in flight, trainer-1's color must already be
    // cleared — never shown "as a placeholder" for the new context.
    await waitFor(() => expect(screen.getByTestId('cinder')).toHaveTextContent('none'))

    resolveSecondFetchHolder.current?.({ logoUrl: null, primaryColorHex: '#222222' })

    expect(await screen.findByText('#222222')).toBeInTheDocument()
    expect(screen.queryByText('#111111')).not.toBeInTheDocument()
    expect(brandingApi.get).toHaveBeenCalledWith('trainer-2')
  })
})

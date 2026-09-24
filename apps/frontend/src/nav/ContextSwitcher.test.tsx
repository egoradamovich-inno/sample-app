import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { playerProfilesApi } from '../api/endpoints/player-profiles'
import { ActiveContextProvider } from './ActiveContextContext'
import { ContextSwitcher } from './ContextSwitcher'

vi.mock('../api/endpoints/player-profiles', () => ({
  playerProfilesApi: { list: vi.fn(), createChild: vi.fn(), addTrainerAssociation: vi.fn(), removeTrainerAssociation: vi.fn() },
}))

const mockUseAuth = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderSwitcher() {
  return render(
    <ActiveContextProvider>
      <ContextSwitcher />
    </ActiveContextProvider>,
  )
}

describe('ContextSwitcher', () => {
  it('should render the parent variant with a "Me" section plus a section per child', async () => {
    mockUseAuth.mockReturnValue({ isChildAccount: false })
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      { id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [{ trainerId: 't1', trainerName: 'Acme Sports', status: 'ACTIVE' }] },
      { id: 'child-1', displayName: 'Kid One', birthDate: null, isChild: true, trainerAssociations: [{ trainerId: 't2', trainerName: 'Beta Trainers', status: 'ACTIVE' }] },
    ])
    const user = userEvent.setup()

    renderSwitcher()
    await user.click(await screen.findByRole('button', { expanded: false }))

    expect(screen.getByText('Me')).toBeInTheDocument()
    expect(screen.getByText('Kid One')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Acme Sports' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Beta Trainers' })).toBeInTheDocument()
  })

  it('should render the child variant as a flat trainer list with no "Me" section', async () => {
    mockUseAuth.mockReturnValue({ isChildAccount: true })
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      { id: 'child-1', displayName: 'Kid One', birthDate: null, isChild: true, trainerAssociations: [{ trainerId: 't2', trainerName: 'Beta Trainers', status: 'ACTIVE' }] },
    ])
    const user = userEvent.setup()

    renderSwitcher()
    await user.click(await screen.findByRole('button', { expanded: false }))

    expect(screen.getByRole('menuitem', { name: 'Beta Trainers' })).toBeInTheDocument()
    expect(screen.queryByText('Me')).not.toBeInTheDocument()
    expect(screen.queryByText('Kid One')).not.toBeInTheDocument()
  })
})

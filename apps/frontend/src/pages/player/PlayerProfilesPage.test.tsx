import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { playerProfilesApi } from '../../api/endpoints/player-profiles'
import { PlayerProfilesPage } from './PlayerProfilesPage'

vi.mock('../../api/endpoints/player-profiles', () => ({
  playerProfilesApi: {
    list: vi.fn(),
    createChild: vi.fn(),
    addTrainerAssociation: vi.fn(),
    removeTrainerAssociation: vi.fn(),
  },
}))

describe('PlayerProfilesPage', () => {
  beforeEach(() => {
    vi.mocked(playerProfilesApi.list).mockReset()
    vi.mocked(playerProfilesApi.createChild).mockReset()
    vi.mocked(playerProfilesApi.removeTrainerAssociation).mockReset()
  })

  it('should list family members with their trainer associations', async () => {
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      { id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [] },
    ])
    render(<PlayerProfilesPage />)
    expect(await screen.findByText('Pat Parent')).toBeInTheDocument()
  })

  it('wires Add-Child modal submit through to a refetch of the family list', async () => {
    vi.mocked(playerProfilesApi.list)
      .mockResolvedValueOnce([{ id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [] }])
      .mockResolvedValueOnce([
        { id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [] },
        { id: 'child-1', displayName: 'Kid One', birthDate: '2018-01-01', isChild: true, trainerAssociations: [] },
      ])
    vi.mocked(playerProfilesApi.createChild).mockResolvedValue({
      id: 'child-1',
      displayName: 'Kid One',
      birthDate: '2018-01-01',
      isChild: true,
      trainerAssociations: [],
    })

    const user = userEvent.setup()
    render(<PlayerProfilesPage />)

    await screen.findByText('Pat Parent')
    await user.click(screen.getByRole('button', { name: /add child/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/child.s name/i), 'Kid One')
    await user.type(within(dialog).getByLabelText(/birth date/i), '2018-01-01')
    await user.type(within(dialog).getByLabelText(/gender/i), 'F')
    await user.click(within(dialog).getByRole('button', { name: /^add child$/i }))

    await waitFor(() => expect(playerProfilesApi.createChild).toHaveBeenCalled())
    expect(await screen.findByText('Kid One')).toBeInTheDocument()
    expect(playerProfilesApi.list).toHaveBeenCalledTimes(2)
  })

  it('should keep the modal open to show the duplicate-sibling warning instead of closing immediately', async () => {
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      { id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [] },
    ])
    vi.mocked(playerProfilesApi.createChild).mockResolvedValue({
      id: 'child-1',
      displayName: 'Kid One',
      birthDate: '2018-01-01',
      isChild: true,
      trainerAssociations: [],
      duplicateWarning: true,
    })

    const user = userEvent.setup()
    render(<PlayerProfilesPage />)

    await screen.findByText('Pat Parent')
    await user.click(screen.getByRole('button', { name: /add child/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/child.s name/i), 'Kid One')
    await user.type(within(dialog).getByLabelText(/birth date/i), '2018-01-01')
    await user.type(within(dialog).getByLabelText(/gender/i), 'F')
    await user.click(within(dialog).getByRole('button', { name: /^add child$/i }))

    expect(await screen.findByText(/similar name and age already exists/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /done/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should not resurface a stale duplicate warning the next time the modal is opened', async () => {
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      { id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [] },
    ])
    vi.mocked(playerProfilesApi.createChild).mockResolvedValue({
      id: 'child-1',
      displayName: 'Kid One',
      birthDate: '2018-01-01',
      isChild: true,
      trainerAssociations: [],
      duplicateWarning: true,
    })

    const user = userEvent.setup()
    render(<PlayerProfilesPage />)

    await screen.findByText('Pat Parent')
    await user.click(screen.getByRole('button', { name: /add child/i }))
    let dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/child.s name/i), 'Kid One')
    await user.type(within(dialog).getByLabelText(/birth date/i), '2018-01-01')
    await user.type(within(dialog).getByLabelText(/gender/i), 'F')
    await user.click(within(dialog).getByRole('button', { name: /^add child$/i }))
    await screen.findByText(/similar name and age already exists/i)
    await user.click(screen.getByRole('button', { name: /done/i }))

    await user.click(screen.getByRole('button', { name: /add child/i }))
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/similar name and age already exists/i)).not.toBeInTheDocument()
  })

  it('should open the Add-Child modal via the keyboard, trap Tab inside it, and return focus to the trigger on Escape', async () => {
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      { id: 'me-1', displayName: 'Pat Parent', birthDate: null, isChild: false, trainerAssociations: [] },
    ])

    const user = userEvent.setup()
    render(<PlayerProfilesPage />)

    await screen.findByText('Pat Parent')
    const trigger = screen.getByRole('button', { name: /add child/i })
    trigger.focus()
    expect(trigger).toHaveFocus()

    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog')

    // Focus moved into the dialog, not left behind on the trigger.
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    // Shift+Tab from the first focusable field wraps to the last focusable element
    // in the dialog (the "Add child" submit button) instead of escaping the modal.
    const nameField = within(dialog).getByLabelText(/child.s name/i)
    nameField.focus()
    await user.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: /^add child$/i })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('should show the RSVP-cancellation warning and call removeTrainerAssociation on confirm', async () => {
    vi.mocked(playerProfilesApi.list).mockResolvedValue([
      {
        id: 'me-1',
        displayName: 'Pat Parent',
        birthDate: null,
        isChild: false,
        trainerAssociations: [{ trainerId: 't1', trainerName: 'Acme Sports', status: 'ACTIVE' }],
      },
    ])
    vi.mocked(playerProfilesApi.removeTrainerAssociation).mockResolvedValue({ cancelledUpcomingRsvps: true })

    const user = userEvent.setup()
    render(<PlayerProfilesPage />)

    await screen.findByText('Acme Sports')
    await user.click(screen.getByRole('button', { name: /remove/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/cancel any upcoming rsvps/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /remove trainer/i }))

    await waitFor(() => expect(playerProfilesApi.removeTrainerAssociation).toHaveBeenCalledWith('me-1', 't1'))
  })
})

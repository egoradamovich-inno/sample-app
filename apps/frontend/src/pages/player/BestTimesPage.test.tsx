import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { availabilityApi } from '../../api/endpoints/availability'
import { ActiveContextProvider, useActiveContext } from '../../nav/ActiveContextContext'
import { BestTimesPage } from './BestTimesPage'

vi.mock('../../api/endpoints/availability', () => ({
  availabilityApi: { getMine: vi.fn(), setMine: vi.fn(), getForPlayer: vi.fn() },
}))

function Harness({ initialTrainerName }: { initialTrainerName: string }) {
  const { setSelection } = useActiveContext()
  return (
    <div>
      <button onClick={() => setSelection({ memberId: 'child-1', memberName: 'Kid One', trainerId: 't1', trainerName: initialTrainerName })}>
        select-child
      </button>
      <BestTimesPage />
    </div>
  )
}

describe('BestTimesPage', () => {
  it("re-fetches the active context member's grid when the switcher selection changes", async () => {
    vi.mocked(availabilityApi.getMine).mockResolvedValue([{ dayOfWeek: 1, startTime: '17:00', endTime: '19:00', isAvailable: true }])
    const user = userEvent.setup()

    render(
      <ActiveContextProvider>
        <Harness initialTrainerName="Acme" />
      </ActiveContextProvider>,
    )

    await waitFor(() => expect(availabilityApi.getMine).toHaveBeenCalledWith(undefined))

    await user.click(screen.getByText('select-child'))

    await waitFor(() => expect(availabilityApi.getMine).toHaveBeenCalledWith('child-1'))
  })

  it('should save the edited grid via setMine', async () => {
    vi.mocked(availabilityApi.getMine).mockResolvedValue([])
    vi.mocked(availabilityApi.setMine).mockResolvedValue([{ dayOfWeek: 1, startTime: '17:00', endTime: '19:00', isAvailable: true }])
    const user = userEvent.setup()

    render(
      <ActiveContextProvider>
        <BestTimesPage />
      </ActiveContextProvider>,
    )

    await screen.findByRole('button', { name: /save availability/i })
    await user.click(screen.getAllByRole('button', { name: /add another range/i })[0])
    await user.click(screen.getByRole('button', { name: /save availability/i }))

    await waitFor(() => expect(availabilityApi.setMine).toHaveBeenCalled())
  })

  it('should add a new time range and reach its inputs by keyboard alone, with no positive tabindex anywhere in the grid', async () => {
    vi.mocked(availabilityApi.getMine).mockResolvedValue([])
    const user = userEvent.setup()

    render(
      <ActiveContextProvider>
        <BestTimesPage />
      </ActiveContextProvider>,
    )

    const mondaySection = (await screen.findByText('Monday')).closest('section')
    expect(mondaySection).not.toBeNull()
    if (mondaySection === null) {
      throw new Error('Monday section not found')
    }

    const addRangeButton = within(mondaySection).getByRole('button', { name: /add another range/i })
    addRangeButton.focus()
    await user.keyboard('{Enter}')

    const startInput = within(mondaySection).getByLabelText(/monday start time/i)
    expect(startInput).toBeInTheDocument()

    // Tab order must follow DOM/visual order: start time -> end time -> remove -> add-another-range.
    startInput.focus()
    await user.tab()
    expect(within(mondaySection).getByLabelText(/monday end time/i)).toHaveFocus()
    await user.tab()
    expect(within(mondaySection).getByRole('button', { name: /remove/i })).toHaveFocus()

    for (const input of document.querySelectorAll('[tabindex]')) {
      expect(Number((input as HTMLElement).getAttribute('tabindex'))).toBeLessThanOrEqual(0)
    }
  })
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { availabilityApi } from '../../api/endpoints/availability'
import { MyTimesPage } from './MyTimesPage'

vi.mock('../../api/endpoints/availability', () => ({
  availabilityApi: { getMine: vi.fn(), setMine: vi.fn(), getForPlayer: vi.fn() },
}))

describe('MyTimesPage', () => {
  it('should support adding a second time range to Monday without clearing the first', async () => {
    vi.mocked(availabilityApi.getMine).mockResolvedValue([{ dayOfWeek: 1, startTime: '16:00', endTime: '18:00', isAvailable: true }])
    vi.mocked(availabilityApi.setMine).mockResolvedValue([])
    const user = userEvent.setup()

    render(<MyTimesPage />)

    const mondaySection = (await screen.findByText('Monday')).closest('section')
    expect(mondaySection).not.toBeNull()
    if (mondaySection === null) {
      throw new Error('Monday section not found')
    }

    // First range already present.
    expect(within(mondaySection).getAllByDisplayValue('16:00')).toHaveLength(1)

    await user.click(within(mondaySection).getByRole('button', { name: /add another range/i }))

    // Both ranges now coexist for the same day.
    expect(within(mondaySection).getAllByDisplayValue('16:00')).toHaveLength(1)
    expect(within(mondaySection).getAllByDisplayValue('09:00')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /save availability/i }))

    await waitFor(() =>
      expect(availabilityApi.setMine).toHaveBeenCalledWith({
        slots: [
          { dayOfWeek: 1, startTime: '16:00', endTime: '18:00', isAvailable: true },
          { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', isAvailable: true },
        ],
      }),
    )
  })

  it('should let a keyboard-only user add a second range and tab through both ranges in order', async () => {
    vi.mocked(availabilityApi.getMine).mockResolvedValue([{ dayOfWeek: 1, startTime: '16:00', endTime: '18:00', isAvailable: true }])
    const user = userEvent.setup()

    render(<MyTimesPage />)

    const mondaySection = (await screen.findByText('Monday')).closest('section')
    expect(mondaySection).not.toBeNull()
    if (mondaySection === null) {
      throw new Error('Monday section not found')
    }

    const addRangeButton = within(mondaySection).getByRole('button', { name: /add another range/i })
    addRangeButton.focus()
    expect(addRangeButton).toHaveFocus()
    await user.keyboard('{Enter}')

    const startInputs = within(mondaySection).getAllByLabelText(/monday start time/i)
    expect(startInputs).toHaveLength(2)

    // Visual/DOM order preserved: first range's fields, then second range's fields,
    // then the (still-present) add-another-range affordance — never a positive
    // tabindex reordering things.
    startInputs[0].focus()
    await user.tab()
    expect(within(mondaySection).getAllByLabelText(/monday end time/i)[0]).toHaveFocus()
    await user.tab()
    expect(within(mondaySection).getAllByRole('button', { name: /remove/i })[0]).toHaveFocus()
    await user.tab()
    expect(startInputs[1]).toHaveFocus()
  })
})

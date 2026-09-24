import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { trainerRosterApi } from '../../api/endpoints/trainer-roster'
import { TrainerRosterPage } from './TrainerRosterPage'

vi.mock('../../api/endpoints/trainer-roster', () => ({
  trainerRosterApi: { list: vi.fn(), filterByAvailability: vi.fn() },
}))

describe('TrainerRosterPage', () => {
  it('should list own-org roster members with an availability summary', async () => {
    vi.mocked(trainerRosterApi.list).mockResolvedValue({
      items: [{ id: 'p1', name: 'Kid One', role: 'PLAYER', availabilitySummary: 'Mon 5-8pm' }],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    render(<TrainerRosterPage />)

    expect(await screen.findByText('Kid One')).toBeInTheDocument()
    expect(screen.getByText('Mon 5-8pm')).toBeInTheDocument()
  })

  it('should delegate to the availability filter when a day and time are selected', async () => {
    vi.mocked(trainerRosterApi.list).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    vi.mocked(trainerRosterApi.filterByAvailability).mockResolvedValue([
      { id: 'p2', name: 'Kid Two', role: 'PLAYER', availabilitySummary: 'Wed 6-9pm' },
    ])
    const user = userEvent.setup()

    render(<TrainerRosterPage />)
    await screen.findByText(/no roster members yet/i)

    await user.click(screen.getByRole('button', { name: 'Wed' }))
    await user.type(screen.getByLabelText(/filter by time/i), '18:00')

    await waitFor(() => expect(trainerRosterApi.filterByAvailability).toHaveBeenCalledWith(3, '18:00'))
    expect(await screen.findByText('Kid Two')).toBeInTheDocument()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sharelinksApi } from '../../api/endpoints/sharelinks'
import { ShareLinkGenerationModal } from './ShareLinkGenerationModal'

vi.mock('../../api/endpoints/sharelinks', () => ({
  sharelinksApi: {
    generateStatic: vi.fn(),
    generateCoachInvite: vi.fn(),
    listCoachInvites: vi.fn(),
    resendCoachInvite: vi.fn(),
    resolve: vi.fn(),
    registerViaLink: vi.fn(),
  },
}))

describe('ShareLinkGenerationModal', () => {
  beforeEach(() => {
    vi.mocked(sharelinksApi.generateStatic).mockReset()
    vi.mocked(sharelinksApi.generateCoachInvite).mockReset()
  })

  it('should generate a static link on open and show the code with a copy action', async () => {
    vi.mocked(sharelinksApi.generateStatic).mockResolvedValue({ code: 'ABC123', url: 'https://app.example/join/ABC123' })
    // @testing-library/user-event's setup() installs its own navigator.clipboard
    // polyfill (for its .copy()/.paste() helpers), so the spy must be installed
    // *after* setup() runs or user-event's own stub wins.
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, configurable: true })

    render(<ShareLinkGenerationModal isOpen linkType="static" onClose={vi.fn()} />)

    expect(await screen.findByText('ABC123')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /copy link/i }))

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith('https://app.example/join/ABC123'))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('should collect a target email before generating a coach-invite link', async () => {
    vi.mocked(sharelinksApi.generateCoachInvite).mockResolvedValue({
      code: 'XYZ789',
      url: 'https://app.example/join/XYZ789',
      expiresAt: '2026-08-01T00:00:00.000Z',
      targetEmail: 'coach@example.com',
    })
    const user = userEvent.setup()

    render(<ShareLinkGenerationModal isOpen linkType="coach-invite" onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/coach email/i), 'coach@example.com')
    await user.click(screen.getByRole('button', { name: /generate invite/i }))

    expect(await screen.findByText('XYZ789')).toBeInTheDocument()
    expect(sharelinksApi.generateCoachInvite).toHaveBeenCalledWith({ targetEmail: 'coach@example.com' })
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { brandingApi } from '../../api/endpoints/branding'
import { TrainerBrandingPage } from './TrainerBrandingPage'

vi.mock('../../api/endpoints/branding', () => ({
  brandingApi: { get: vi.fn(), update: vi.fn(), uploadLogo: vi.fn() },
}))

describe('TrainerBrandingPage', () => {
  beforeEach(() => {
    vi.mocked(brandingApi.get).mockReset().mockResolvedValue({ logoUrl: null, primaryColorHex: '#123456' })
    vi.mocked(brandingApi.uploadLogo).mockReset()
    vi.mocked(brandingApi.update).mockReset()
    if (!('createObjectURL' in URL)) {
      // jsdom doesn't implement this.
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), configurable: true })
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    }
  })

  it('should reject an .svg upload client-side before ever calling the API', async () => {
    render(<TrainerBrandingPage />)
    const input = await screen.findByLabelText(/upload logo/i)

    const svgFile = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' })
    // `user.upload()` respects the input's `accept` filter and would silently drop
    // this file before firing a change event at all — but a renamed/spoofed file or
    // a drag-and-drop can still reach the real browser's input, so the client-side
    // guard must be exercised via a raw change event, not user-event's upload helper.
    Object.defineProperty(input, 'files', { value: [svgFile], configurable: true })
    fireEvent.change(input)

    expect(await screen.findByText(/svg logos are not supported/i)).toBeInTheDocument()
    expect(brandingApi.uploadLogo).not.toHaveBeenCalled()
  })

  it('should upload a PNG logo and show it in the mock header preview', async () => {
    vi.mocked(brandingApi.uploadLogo).mockResolvedValue({ logoUrl: 'https://cdn.example/logo.png', primaryColorHex: '#123456' })
    const user = userEvent.setup()
    render(<TrainerBrandingPage />)
    await screen.findByLabelText(/upload logo/i)

    const pngFile = new File(['fake-bytes'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/upload logo/i), pngFile)

    await waitFor(() => expect(brandingApi.uploadLogo).toHaveBeenCalledWith(pngFile))
    expect(await screen.findByText(/logo updated/i)).toBeInTheDocument()
  })

  it('should save the picked color and support resetting to the default', async () => {
    vi.mocked(brandingApi.update).mockResolvedValue({ logoUrl: null, primaryColorHex: '#abcdef' })
    const user = userEvent.setup()
    render(<TrainerBrandingPage />)

    const picker = await screen.findByLabelText(/^primary color$/i)
    expect(picker).toHaveValue('#123456')

    await user.click(screen.getByRole('button', { name: /save color/i }))
    await waitFor(() => expect(brandingApi.update).toHaveBeenCalledWith({ primaryColorHex: '#123456' }))

    await user.click(screen.getByRole('button', { name: /reset to default/i }))
    expect(picker).toHaveValue('#e2621b')
  })

  it('should let a keyboard-only user tab from the logo input through to the color controls and activate them without a mouse', async () => {
    vi.mocked(brandingApi.update).mockResolvedValue({ logoUrl: null, primaryColorHex: '#abcdef' })
    const user = userEvent.setup()
    render(<TrainerBrandingPage />)

    const logoInput = await screen.findByLabelText(/upload logo/i)
    logoInput.focus()
    expect(logoInput).toHaveFocus()

    await user.tab()
    expect(await screen.findByLabelText(/^primary color$/i)).toHaveFocus()

    await user.tab()
    const saveButton = screen.getByRole('button', { name: /save color/i })
    expect(saveButton).toHaveFocus()

    // Activated with the keyboard (Enter), not a click.
    await user.keyboard('{Enter}')
    await waitFor(() => expect(brandingApi.update).toHaveBeenCalledWith({ primaryColorHex: '#123456' }))

    await user.tab()
    expect(screen.getByRole('button', { name: /reset to default/i })).toHaveFocus()
  })
})

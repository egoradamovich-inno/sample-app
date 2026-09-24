import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { profileApi } from '../api/endpoints/profile'
import type { Profile } from '../api/endpoints/profile'
import { ProfileEditPage } from './ProfileEditPage'

vi.mock('../api/endpoints/profile', () => ({
  profileApi: { getOwn: vi.fn(), updateOwn: vi.fn(), uploadPhoto: vi.fn() },
}))

const BASE_PROFILE = {
  id: '1',
  email: 'player@example.com',
  status: 'ACTIVE',
  createdAt: '2026-01-15T00:00:00.000Z',
  firstName: 'Pat',
  lastName: 'Player',
}

describe('ProfileEditPage', () => {
  it("renders the Player field set (school/jersey/photo) and read-only email/role/skillLevel/created rows", async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'PLAYER',
      skillLevel: 'Intermediate',
    } as Profile)

    render(<ProfileEditPage />)

    expect(await screen.findByLabelText(/school/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/jersey number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^photo$/i)).toBeInTheDocument()

    // Read-only fields are static text, not inputs of any kind.
    expect(screen.getByText('player@example.com')).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.getByText('PLAYER')).toBeInTheDocument()
    expect(screen.getByText('Intermediate')).toBeInTheDocument()
    expect(screen.getByText(new Date(BASE_PROFILE.createdAt).toLocaleDateString())).toBeInTheDocument()
  })

  it('renders the Coach field set (bio/credentials/certifications/public-profile switch)', async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'COACH',
      bio: 'Coach bio',
      credentials: 'USSF License',
      certifications: ['CPR'],
      publicVisible: false,
    } as Profile)

    render(<ProfileEditPage />)

    expect(await screen.findByLabelText(/^bio$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/credentials/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/certifications/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /show my public coach profile/i })).toBeInTheDocument()
  })

  it('renders the Trainer field set (business name/org details)', async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'TRAINER',
      businessName: 'Acme Sports',
      address: '123 Main St',
      website: 'https://acme.example',
      description: 'Youth training org',
    } as Profile)

    render(<ProfileEditPage />)

    expect(await screen.findByLabelText(/business name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })

  it('does not render a photo <img> when the player has no photoUrl yet', async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'PLAYER',
      skillLevel: 'Intermediate',
      photoUrl: null,
    } as Profile)

    render(<ProfileEditPage />)

    await screen.findByLabelText(/^photo$/i)
    expect(screen.queryByRole('img', { name: /profile/i })).not.toBeInTheDocument()
  })

  it('renders the existing photo as an <img> when the player already has one', async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'PLAYER',
      skillLevel: 'Intermediate',
      photoUrl: '/uploads/photos/existing.png',
    } as Profile)

    render(<ProfileEditPage />)

    const img = await screen.findByRole('img', { name: /profile/i })
    expect(img).toHaveAttribute('src', '/uploads/photos/existing.png')
  })

  it('renders the uploaded photo immediately after a successful upload', async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'PLAYER',
      skillLevel: 'Intermediate',
      photoUrl: null,
    } as Profile)
    vi.mocked(profileApi.uploadPhoto).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'PLAYER',
      skillLevel: 'Intermediate',
      photoUrl: '/uploads/photos/new-upload.png',
    } as Profile)

    const user = userEvent.setup()
    render(<ProfileEditPage />)

    const photoInput = await screen.findByLabelText(/^photo$/i)
    expect(screen.queryByRole('img', { name: /profile/i })).not.toBeInTheDocument()

    const file = new File(['binary-data'], 'photo.png', { type: 'image/png' })
    await user.upload(photoInput, file)

    const img = await screen.findByRole('img', { name: /profile/i })
    expect(img).toHaveAttribute('src', '/uploads/photos/new-upload.png')
  })

  it('shows the error banner instead of failing silently when the photo upload rejects', async () => {
    vi.mocked(profileApi.getOwn).mockResolvedValue({
      ...BASE_PROFILE,
      role: 'PLAYER',
      skillLevel: 'Intermediate',
    } as Profile)
    vi.mocked(profileApi.uploadPhoto).mockRejectedValue(new Error('network error'))

    const user = userEvent.setup()
    render(<ProfileEditPage />)

    const photoInput = await screen.findByLabelText(/^photo$/i)
    const file = new File(['binary-data'], 'photo.png', { type: 'image/png' })
    await user.upload(photoInput, file)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to upload your photo/i)
    })
  })
})

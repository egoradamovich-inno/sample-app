import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { coachApi } from '../../api/endpoints/coach'
import { CoachPublicProfilePage } from './CoachPublicProfilePage'

vi.mock('../../api/endpoints/coach', () => ({
  coachApi: { updateProfile: vi.fn(), getPublicProfile: vi.fn(), checkConflict: vi.fn(), recordOverride: vi.fn() },
}))

function renderAtSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/coach/public/${slug}`]}>
      <Routes>
        <Route path="/coach/public/:slug" element={<CoachPublicProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CoachPublicProfilePage', () => {
  it('should render the coach bio when the profile is found and public', async () => {
    vi.mocked(coachApi.getPublicProfile).mockResolvedValue({
      name: 'Casey Coach',
      bio: 'Loves teaching fundamentals.',
      credentials: 'USSF B License',
      certifications: ['CPR'],
    })

    renderAtSlug('casey-coach')

    expect(await screen.findByText('Casey Coach')).toBeInTheDocument()
    expect(screen.getByText('Loves teaching fundamentals.')).toBeInTheDocument()
  })

  it('should show identical not-found copy for a nonexistent slug (404)', async () => {
    vi.mocked(coachApi.getPublicProfile).mockRejectedValue(
      Object.assign(new Error('not found'), { isAxiosError: true, response: { status: 404, data: {} } }),
    )
    renderAtSlug('does-not-exist')
    expect(await screen.findByText("This coach profile isn't available.")).toBeInTheDocument()
  })

  it('should show the identical not-found copy for a not-public or deactivated coach (same uniform 404)', async () => {
    vi.mocked(coachApi.getPublicProfile).mockRejectedValue(
      Object.assign(new Error('not found'), { isAxiosError: true, response: { status: 404, data: {} } }),
    )
    renderAtSlug('private-or-deactivated-coach')
    expect(await screen.findByText("This coach profile isn't available.")).toBeInTheDocument()
  })
})

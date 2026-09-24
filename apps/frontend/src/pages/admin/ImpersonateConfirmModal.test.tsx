import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UserSummary } from '../../types/api'
import { ImpersonateConfirmModal } from './ImpersonateConfirmModal'

const TARGET: UserSummary = {
  id: '1',
  name: 'Tom Trainer',
  email: 'tom@example.com',
  role: 'TRAINER',
  status: 'ACTIVE',
  lastLoginAt: null,
}

describe('ImpersonateConfirmModal', () => {
  it('should render nothing when there is no target', () => {
    render(<ImpersonateConfirmModal target={null} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("should show the target's name, role, and the 1-hour auto-expiry reminder", () => {
    render(<ImpersonateConfirmModal target={TARGET} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveTextContent(/view platform as tom trainer/i)
    expect(screen.getByRole('dialog')).toHaveTextContent(/trainer/i)
    expect(screen.getByRole('dialog')).toHaveTextContent(/1 hour/i)
  })

  it('should call onConfirm when confirmed and onCancel when cancelled', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ImpersonateConfirmModal target={TARGET} onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /view platform as/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

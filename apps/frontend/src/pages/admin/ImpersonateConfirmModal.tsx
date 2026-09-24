import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { UserSummary } from '../../types/api'

export interface ImpersonateConfirmModalProps {
  target: UserSummary | null
  onConfirm: () => void
  onCancel: () => void
  isSubmitting?: boolean
}

/** 480px confirm modal — the one place besides ImpersonationBanner that uses
 * `--color-alert` instead of `--color-cinder`, since this starts an ongoing
 * exceptional mode rather than a routine primary action. */
export function ImpersonateConfirmModal({
  target,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ImpersonateConfirmModalProps) {
  return (
    <Modal isOpen={target !== null} onClose={onCancel} title={`View platform as ${target?.name ?? ''}?`}>
      {target !== null && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink">
            You&apos;ll see the platform exactly as <strong>{target.name}</strong> ({target.role}) does. This
            session automatically expires in 1 hour.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="alert" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Starting…' : 'View platform as'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

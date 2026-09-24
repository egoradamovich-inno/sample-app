import { useCallback, useEffect, useState } from 'react'
import type { CreateChildProfilePayload, PlayerProfileSummary } from '../../api/endpoints/player-profiles'
import { playerProfilesApi } from '../../api/endpoints/player-profiles'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StampBadge } from '../../components/ui/StampBadge'
import type { StampVariant } from '../../components/ui/StampBadge'
import { TextField } from '../../components/ui/TextField'

interface AddChildProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

function AddChildProfileModal({ isOpen, onClose, onCreated }: AddChildProfileModalProps) {
  const [form, setForm] = useState<CreateChildProfilePayload>({ displayName: '', birthDate: '', gender: '' })
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // The modal shell (Modal) unmounts only its own children while closed —
  // this component and its state stay mounted, so a stale warning from a
  // previous open would otherwise linger into the next one.
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setDuplicateWarning(false)
    }
  }, [isOpen])

  async function handleSubmit(): Promise<void> {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await playerProfilesApi.createChild(form)
      onCreated()
      setForm({ displayName: '', birthDate: '', gender: '' })
      if (result.duplicateWarning === true) {
        // The child was already created — keep the modal open just to show
        // the warning (closing immediately, the previous behavior, hid it
        // before it could ever render) rather than to let them resubmit,
        // which would create a second duplicate.
        setDuplicateWarning(true)
      } else {
        onClose()
      }
    } catch {
      setError('Unable to add this child profile. Please check the details and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Child">
      {duplicateWarning ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-status-pending">
            A family member with a similar name and age already exists — this is just a heads-up, not a block. This
            child profile has been added.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error !== null && <p className="text-body text-status-deleted">{error}</p>}
          <TextField
            label="Child's name"
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <TextField
            label="Birth date"
            type="date"
            required
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
          />
          <TextField
            label="Gender"
            required
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add child'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

interface RemovalTarget {
  profileId: string
  trainerId: string
  trainerName: string
}

interface RemoveAssociationConfirmModalProps {
  target: RemovalTarget | null
  onConfirm: () => void
  onCancel: () => void
  isSubmitting: boolean
}

function RemoveAssociationConfirmModal({ target, onConfirm, onCancel, isSubmitting }: RemoveAssociationConfirmModalProps) {
  return (
    <Modal isOpen={target !== null} onClose={onCancel} title={`Remove ${target?.trainerName ?? ''}?`}>
      {target !== null && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink">
            Removing this trainer will cancel any upcoming RSVPs tied to them. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Removing…' : 'Remove trainer'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const ASSOCIATION_STATUS_VARIANT: Record<string, StampVariant> = {
  ACTIVE: 'active',
  REMOVED: 'inactive',
}

export function PlayerProfilesPage() {
  const [profiles, setProfiles] = useState<PlayerProfileSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<RemovalTarget | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await playerProfilesApi.list()
      setProfiles(result)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProfiles()
  }, [fetchProfiles])

  async function handleRemoveConfirm(): Promise<void> {
    if (pendingRemoval === null) {
      return
    }
    setIsRemoving(true)
    try {
      await playerProfilesApi.removeTrainerAssociation(pendingRemoval.profileId, pendingRemoval.trainerId)
      setPendingRemoval(null)
      await fetchProfiles()
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Family</h1>
        <Button onClick={() => setIsAddOpen(true)}>+ Add Child</Button>
      </div>

      {isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {profiles.map((profile) => (
            <section key={profile.id} className="rounded-sm border border-rule p-4">
              <h2 className="mb-2 font-display text-display-md uppercase tracking-tight text-ink">{profile.displayName}</h2>
              {profile.trainerAssociations.length === 0 ? (
                <p className="text-body text-ink-soft">No trainers yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {profile.trainerAssociations.map((association) => (
                    <li key={association.trainerId} className="flex items-center justify-between gap-3">
                      <span className="text-body text-ink">{association.trainerName}</span>
                      <div className="flex items-center gap-3">
                        <StampBadge
                          label={association.status}
                          variant={ASSOCIATION_STATUS_VARIANT[association.status] ?? 'neutral'}
                        />
                        <button
                          type="button"
                          className="text-body text-status-deleted underline"
                          onClick={() =>
                            setPendingRemoval({
                              profileId: profile.id,
                              trainerId: association.trainerId,
                              trainerName: association.trainerName,
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <AddChildProfileModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onCreated={() => void fetchProfiles()} />
      <RemoveAssociationConfirmModal
        target={pendingRemoval}
        onConfirm={() => void handleRemoveConfirm()}
        onCancel={() => setPendingRemoval(null)}
        isSubmitting={isRemoving}
      />
    </main>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminUsersApi } from '../../api/endpoints/admin-users'
import type { CreateTrainerPayload, ListUsersParams } from '../../api/endpoints/admin-users'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import type { LedgerColumn } from '../../components/ui/LedgerTable'
import { LedgerTable } from '../../components/ui/LedgerTable'
import { Modal } from '../../components/ui/Modal'
import { StampBadge } from '../../components/ui/StampBadge'
import type { StampVariant } from '../../components/ui/StampBadge'
import { TextField } from '../../components/ui/TextField'
import type { Role, UserStatus, UserSummary } from '../../types/api'
import { ImpersonateConfirmModal } from './ImpersonateConfirmModal'

const PAGE_SIZE = 20

const STATUS_VARIANT: Record<UserStatus, StampVariant> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
}

interface UserCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

function UserCreateModal({ isOpen, onClose, onCreated }: UserCreateModalProps) {
  const [form, setForm] = useState<CreateTrainerPayload>({
    businessName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(): Promise<void> {
    setError(null)
    setIsSubmitting(true)
    try {
      await adminUsersApi.create({ ...form, phone: form.phone || undefined })
      setForm({ businessName: '', firstName: '', lastName: '', email: '', phone: '' })
      onCreated()
      onClose()
    } catch {
      setError('Unable to create trainer. Check the email address and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Trainer">
      <div className="flex flex-col gap-4">
        {error !== null && <p className="text-body text-status-deleted">{error}</p>}
        <TextField
          label="Business name"
          required
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
        />
        <TextField
          label="First name"
          required
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />
        <TextField
          label="Last name"
          required
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
        <TextField
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextField
          label="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send Invite'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface DeactivateConfirmModalProps {
  target: UserSummary | null
  onConfirm: () => void
  onCancel: () => void
  isSubmitting: boolean
}

function DeactivateConfirmModal({ target, onConfirm, onCancel, isSubmitting }: DeactivateConfirmModalProps) {
  const isReactivating = target?.status === 'INACTIVE'
  return (
    <Modal
      isOpen={target !== null}
      onClose={onCancel}
      title={isReactivating ? `Reactivate ${target?.name ?? ''}?` : `Deactivate ${target?.name ?? ''}?`}
    >
      {target !== null && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink">
            {isReactivating
              ? `${target.name} will be able to log in again immediately.`
              : `${target.name} will be blocked from logging in until reactivated. Their history and records stay intact.`}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isReactivating ? 'Reactivate' : 'Deactivate'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

interface DeleteConfirmModalProps {
  target: UserSummary | null
  onConfirm: () => void
  onCancel: () => void
  isSubmitting: boolean
}

function DeleteConfirmModal({ target, onConfirm, onCancel, isSubmitting }: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={target !== null} onClose={onCancel} title={`Delete ${target?.name ?? ''}?`}>
      {target !== null && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink">
            This permanently anonymizes {target.name}&apos;s name, email, and phone number. This cannot be
            undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="alert" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function UsersListPage() {
  const { startImpersonation } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState<UserSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [isLoading, setIsLoading] = useState(false)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [pendingDeactivate, setPendingDeactivate] = useState<UserSummary | null>(null)
  const [pendingDelete, setPendingDelete] = useState<UserSummary | null>(null)
  const [pendingImpersonate, setPendingImpersonate] = useState<UserSummary | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: ListUsersParams = { page, pageSize: PAGE_SIZE }
      if (search !== '') {
        params.search = search
      }
      if (role !== '') {
        params.role = role
      }
      if (status !== '') {
        params.status = status
      }
      const result = await adminUsersApi.list(params)
      setItems(result.items)
      setTotal(result.total)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, role, status])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  async function handleDeactivateConfirm(): Promise<void> {
    if (pendingDeactivate === null) {
      return
    }
    setIsMutating(true)
    try {
      if (pendingDeactivate.status === 'INACTIVE') {
        await adminUsersApi.reactivate(pendingDeactivate.id)
      } else {
        await adminUsersApi.deactivate(pendingDeactivate.id)
      }
      setPendingDeactivate(null)
      await fetchUsers()
    } finally {
      setIsMutating(false)
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (pendingDelete === null) {
      return
    }
    setIsMutating(true)
    try {
      await adminUsersApi.remove(pendingDelete.id)
      setPendingDelete(null)
      await fetchUsers()
    } finally {
      setIsMutating(false)
    }
  }

  async function handleImpersonateConfirm(): Promise<void> {
    if (pendingImpersonate === null) {
      return
    }
    setIsMutating(true)
    try {
      await startImpersonation(pendingImpersonate.id)
      setPendingImpersonate(null)
      navigate('/', { replace: true })
    } finally {
      setIsMutating(false)
    }
  }

  const columns: LedgerColumn<UserSummary>[] = [
    { key: 'name', label: 'Name', render: (row) => row.name },
    { key: 'email', label: 'Email', render: (row) => <span className="font-mono text-mono">{row.email}</span> },
    { key: 'role', label: 'Role', render: (row) => <StampBadge label={row.role} variant="neutral" /> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StampBadge label={row.status} variant={STATUS_VARIANT[row.status]} />,
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (row) => (
        <span className="font-mono text-mono">{row.lastLoginAt !== null ? new Date(row.lastLoginAt).toLocaleString() : 'Never'}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status !== 'DELETED' && (
            <button
              type="button"
              className="text-body text-cinder underline"
              onClick={() => setPendingImpersonate(row)}
            >
              Impersonate
            </button>
          )}
          {row.status !== 'DELETED' && (
            <button
              type="button"
              className="text-body text-ink-soft underline"
              onClick={() => setPendingDeactivate(row)}
            >
              {row.status === 'INACTIVE' ? 'Reactivate' : 'Deactivate'}
            </button>
          )}
          {row.status !== 'DELETED' && (
            <button
              type="button"
              className="text-body text-status-deleted underline"
              onClick={() => setPendingDelete(row)}
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Users</h1>
        <Button onClick={() => setIsCreateOpen(true)}>+ Create Trainer</Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <TextField
          label="Search"
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="Name or email"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="role-filter" className="text-label uppercase tracking-wide text-ink-soft">
            Role
          </label>
          <select
            id="role-filter"
            value={role}
            onChange={(e) => {
              setPage(1)
              setRole(e.target.value as Role | '')
            }}
            className="rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-body text-ink"
          >
            <option value="">All roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="TRAINER">Trainer</option>
            <option value="COACH">Coach</option>
            <option value="PLAYER">Player</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status-filter" className="text-label uppercase tracking-wide text-ink-soft">
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value as UserStatus | '')
            }}
            className="rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-body text-ink"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DELETED">Deleted</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <>
          <LedgerTable
            columns={columns}
            rows={items}
            getRowKey={(row) => row.id}
            emptyMessage="No users match these filters."
            caption="Users"
          />
          <div className="mt-4 flex items-center justify-between text-body">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <UserCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={() => void fetchUsers()} />
      <DeactivateConfirmModal
        target={pendingDeactivate}
        onConfirm={() => void handleDeactivateConfirm()}
        onCancel={() => setPendingDeactivate(null)}
        isSubmitting={isMutating}
      />
      <DeleteConfirmModal
        target={pendingDelete}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setPendingDelete(null)}
        isSubmitting={isMutating}
      />
      <ImpersonateConfirmModal
        target={pendingImpersonate}
        onConfirm={() => void handleImpersonateConfirm()}
        onCancel={() => setPendingImpersonate(null)}
        isSubmitting={isMutating}
      />
    </main>
  )
}

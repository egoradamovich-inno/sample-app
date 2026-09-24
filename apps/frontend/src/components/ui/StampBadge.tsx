export type StampVariant = 'active' | 'inactive' | 'deleted' | 'pending' | 'neutral' | 'alert'

const VARIANT_CLASSES: Record<StampVariant, string> = {
  active: 'border-status-active text-status-active',
  inactive: 'border-status-inactive text-status-inactive',
  deleted: 'border-status-deleted text-status-deleted',
  pending: 'border-status-pending text-status-pending',
  neutral: 'border-ink text-ink',
  alert: 'border-alert text-alert',
}

export interface StampBadgeProps {
  label: string
  variant?: StampVariant
  animate?: boolean
}

/** The "Roster Stamp" motif — an ink-stamp badge for status, never a default pill badge. */
export function StampBadge({ label, variant = 'neutral', animate = false }: StampBadgeProps) {
  return (
    <span
      className={`inline-block -rotate-2 rounded-sm border-2 px-2 py-0.5 font-display text-label uppercase tracking-wide ${VARIANT_CLASSES[variant]} ${
        animate ? 'motion-safe:animate-[stamp-settle_220ms_ease-out] motion-reduce:animate-none' : ''
      }`}
    >
      {label}
    </span>
  )
}

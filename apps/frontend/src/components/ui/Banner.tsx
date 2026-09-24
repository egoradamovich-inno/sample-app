import type { ReactNode } from 'react'

export type BannerVariant = 'error' | 'success' | 'info'

const VARIANT_CLASSES: Record<BannerVariant, string> = {
  error: 'border-status-deleted text-status-deleted bg-cinder-tint',
  success: 'border-status-active text-status-active bg-cinder-tint',
  info: 'border-ink-soft text-ink bg-paper-raised',
}

export interface BannerProps {
  variant?: BannerVariant
  children: ReactNode
}

export function Banner({ variant = 'info', children }: BannerProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-sm border-l-4 px-4 py-3 text-body ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </div>
  )
}

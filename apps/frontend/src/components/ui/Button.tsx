import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'outline' | 'alert' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

// `alert` is reserved for impersonation-only actions (frontend-design-spec.md) —
// every other primary action in the system uses `primary` (--color-cinder).
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-cinder text-paper-raised hover:bg-cinder-dark',
  outline: 'border border-ink text-ink hover:bg-rule bg-transparent',
  alert: 'bg-alert text-alert-ink hover:bg-alert-dark',
  ghost: 'text-ink-soft hover:text-ink bg-transparent',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 font-body text-body font-semibold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinder disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}

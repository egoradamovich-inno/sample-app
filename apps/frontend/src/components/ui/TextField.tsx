import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function TextField({ label, error, hint, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = error !== undefined ? `${fieldId}-error` : undefined
  const hintId = hint !== undefined ? `${fieldId}-hint` : undefined
  const describedBy = [hintId, errorId].filter((value): value is string => value !== undefined).join(' ')

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-label uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
        className={`rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 font-body text-body text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-cinder ${className}`}
        {...props}
      />
      {hint !== undefined && error === undefined && (
        <p id={hintId} className="text-body text-ink-soft">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-body text-status-deleted">
          {error}
        </p>
      )}
    </div>
  )
}

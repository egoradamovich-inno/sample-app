import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidthClassName?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Slide-up modal shell — the shared shape reused across every modal in this task's scope.
 * Traps Tab/Shift+Tab within the dialog while open (WCAG 2.4.3) and returns focus to
 * whatever triggered it (the "Add Child" button, etc) on any close path — Escape,
 * backdrop click, or a Cancel/Confirm button inside — not just the Escape path. */
export function Modal({ isOpen, onClose, title, children, maxWidthClassName = 'max-w-[480px]' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'Tab' && dialogRef.current !== null) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        if (focusable.length === 0) {
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidthClassName} rounded-sm bg-paper-raised p-6 shadow-xl motion-safe:animate-[modal-slide-up_150ms_ease-out] motion-reduce:animate-none`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="mb-4 font-display text-2xl uppercase tracking-tight text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}

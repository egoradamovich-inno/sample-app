---
title: Implement Focus Trap in Modals
impact: HIGH
impactDescription: prevents keyboard users from getting lost behind modal
tags: keyboard, focus-trap, modal, dialog
related: [keyboard-tab-order, aria-expanded-states]
---

## Implement Focus Trap in Modals

**Impact: HIGH (prevents keyboard users from getting lost behind modal)**

When a modal opens, focus must move into it and stay trapped until closed. On close, return focus to the trigger. WCAG 2.4.3 Focus Order.

**Incorrect: no focus management**

```tsx
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null
  return (
    <div className="overlay">
      <div className="modal">{children}<button onClick={onClose}>Close</button></div>
    </div>
  )
}
```

**Correct: native dialog with built-in focus trap**

```tsx
function Modal({ isOpen, onClose, children }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    isOpen ? dialog.showModal() : dialog.close()
  }, [isOpen])
  return (
    <dialog ref={dialogRef} onClose={onClose}>
      {children}
      <button onClick={onClose}>Close</button>
    </dialog>
  )
}
```

`<dialog>` with `showModal()` provides focus trapping, Escape key, and inert background automatically.

Focus trapping must maintain logical [[keyboard-tab-order]] within the modal. Communicate open/close states to screen readers via [[aria-expanded-states]].

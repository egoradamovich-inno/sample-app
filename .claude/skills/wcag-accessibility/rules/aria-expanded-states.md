---
title: Communicate Expandable Widget States
impact: MEDIUM-HIGH
impactDescription: AT users cannot perceive open/closed state without ARIA
tags: aria, expanded, states, widgets
related: [keyboard-focus-trap, aria-live-regions]
---

## Communicate Expandable Widget States

**Impact: MEDIUM-HIGH (AT users cannot perceive open/closed state without ARIA)**

Toggleable widgets (accordions, dropdowns, menus) must communicate state with `aria-expanded`. WCAG 4.1.2.

**Incorrect: no state communication**

```tsx
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <div onClick={() => setIsOpen(!isOpen)}>{title} {isOpen ? '▲' : '▼'}</div>
      {isOpen && <div>{children}</div>}
    </div>
  )
}
```

**Correct: ARIA states communicated**

```tsx
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false)
  const contentId = useId()
  return (
    <div>
      <button aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen(!isOpen)}>
        {title} <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>
      <div id={contentId} role="region" hidden={!isOpen}>{children}</div>
    </div>
  )
}
```

Also use `aria-expanded` for dropdown menus, disclosure widgets, and tree nodes.

Expandable widgets often need [[keyboard-focus-trap]] when opened (modals, dialogs). State changes may need [[aria-live-regions]] to announce updates to screen readers.

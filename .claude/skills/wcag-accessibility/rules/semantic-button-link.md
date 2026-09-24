---
title: Use Button for Actions, Link for Navigation
impact: CRITICAL
impactDescription: conveys correct interaction model to assistive tech
tags: semantic, button, link, interaction
related: [aria-prefer-semantic, keyboard-interactive-elements]
---

## Use Button for Actions, Link for Navigation

**Impact: CRITICAL (conveys correct interaction model to assistive tech)**

Use `<button>` for in-page actions and `<a>` for navigation to URLs. Using `<div>` or `<span>` with onClick loses keyboard support and screen reader semantics. WCAG 4.1.2 Name, Role, Value.

**Incorrect: div as button**

```tsx
function Actions() {
  return (
    <>
      <div className="btn" onClick={handleSubmit}>Submit</div>
      <span onClick={() => setOpen(true)}>Open Menu</span>
      <a href="#" onClick={(e) => { e.preventDefault(); doAction() }}>Delete</a>
    </>
  )
}
```

**Correct: semantic elements**

```tsx
function Actions() {
  return (
    <>
      <button onClick={handleSubmit}>Submit</button>
      <button onClick={() => setOpen(true)}>Open Menu</button>
      <button onClick={doAction}>Delete</button>
      <a href="/settings">Go to Settings</a>
    </>
  )
}
```

If you must use a non-semantic element, add `role="button"`, `tabIndex={0}`, and keyboard handlers for Enter/Space. But prefer native elements.

Using the correct element ensures native keyboard behavior per [[keyboard-interactive-elements]]. Avoid using ARIA roles to replicate native semantics — see [[aria-prefer-semantic]].

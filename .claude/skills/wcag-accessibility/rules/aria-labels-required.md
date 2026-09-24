---
title: Provide Accessible Names for Interactive Elements
impact: HIGH
impactDescription: screen readers announce nothing for unlabeled controls
tags: aria, labels, accessible-name
related: [forms-labels-required, media-alt-text]
---

## Provide Accessible Names for Interactive Elements

**Impact: HIGH (screen readers announce nothing for unlabeled controls)**

Every interactive element must have an accessible name via visible text, `aria-label`, or `aria-labelledby`. WCAG 4.1.2 Name, Role, Value.

**Incorrect: icon buttons without labels**

```tsx
<button onClick={onClose}><XIcon /></button>
<button onClick={onSearch}><SearchIcon /></button>
<a href="/profile"><img src="avatar.png" /></a>
```

**Correct: labeled interactive elements**

```tsx
<button onClick={onClose} aria-label="Close dialog"><XIcon aria-hidden="true" /></button>
<button onClick={onSearch} aria-label="Search"><SearchIcon aria-hidden="true" /></button>
<a href="/profile" aria-label="User profile"><img src="avatar.png" alt="" /></a>
```

Priority for accessible names: visible text > `aria-labelledby` > `aria-label` > `title`.

For form inputs specifically, [[forms-labels-required]] covers visible label patterns. For images, [[media-alt-text]] provides the accessible name via `alt` attribute.

---
title: Use Proper List Structure
impact: HIGH
impactDescription: screen readers announce list length and position
tags: semantic, lists, structure
related: [aria-prefer-semantic, semantic-table-markup]
---

## Use Proper List Structure

**Impact: HIGH (screen readers announce list length and item position)**

Use `<ul>`, `<ol>`, `<dl>` for lists of items. Screen readers announce "list, 5 items" and allow users to navigate by list items. WCAG 1.3.1.

**Incorrect: divs as list**

```tsx
function Nav() {
  return (
    <div className="menu">
      <div className="menu-item">Home</div>
      <div className="menu-item">About</div>
      <div className="menu-item">Contact</div>
    </div>
  )
}
```

**Correct: semantic list**

```tsx
function Nav() {
  return (
    <nav aria-label="Main">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  )
}
```

For tabular data, use [[semantic-table-markup]] instead of lists. Both follow the principle in [[aria-prefer-semantic]] — native HTML over ARIA roles.

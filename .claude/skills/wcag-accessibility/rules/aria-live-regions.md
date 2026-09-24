---
title: Use aria-live for Dynamic Content
impact: HIGH
impactDescription: screen readers miss dynamic updates without live regions
tags: aria, live-regions, dynamic-content
related: [forms-error-messages, aria-expanded-states]
---

## Use aria-live for Dynamic Content

**Impact: HIGH (screen readers miss dynamic updates without live regions)**

When content updates dynamically (notifications, validation, loading), use `aria-live` to announce changes. WCAG 4.1.3 Status Messages.

**Incorrect: silent dynamic updates**

```tsx
function SearchResults({ results, loading }) {
  return (
    <div>
      {loading && <div>Loading...</div>}
      {results.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  )
}
```

**Correct: announced dynamic updates**

```tsx
function SearchResults({ results, loading }) {
  return (
    <div>
      <div aria-live="polite" aria-atomic="true">
        {loading ? 'Loading results...' : `${results.length} results found`}
      </div>
      {results.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  )
}
```

Use `aria-live="polite"` for status updates, `"assertive"` only for critical alerts. The live region element must exist in DOM before content changes.

Live regions are essential for [[forms-error-messages]] that appear dynamically. For expandable widgets, [[aria-expanded-states]] communicates state changes that may also need live announcement.

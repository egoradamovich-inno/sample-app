---
title: Associate Error Messages with Inputs
impact: MEDIUM-HIGH
impactDescription: AT users cannot find errors without programmatic association
tags: forms, errors, validation
related: [aria-live-regions, color-not-only-indicator]
---

## Associate Error Messages with Inputs

**Impact: MEDIUM-HIGH (AT users cannot find errors without programmatic association)**

Error messages must be linked to their input fields programmatically. WCAG 3.3.1, 3.3.3.

**Incorrect: disconnected error**

```tsx
<input type="email" />
{error && <span className="text-red-500">{error}</span>}
```

**Correct: associated error**

```tsx
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && <span id="email-error" role="alert">{error}</span>}
```

Use `aria-describedby` to link error to input, `aria-invalid` to mark the field, `role="alert"` for dynamic announcements.

Error messages should use [[aria-live-regions]] to announce to screen readers when they appear. Don't rely only on red text — [[color-not-only-indicator]] requires additional visual cues like icons or text.

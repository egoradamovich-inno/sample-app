---
title: Use Autocomplete Attributes
impact: MEDIUM
impactDescription: helps users with cognitive and motor impairments
tags: forms, autocomplete, input-purpose
related: [forms-labels-required]
---

## Use Autocomplete Attributes

**Impact: MEDIUM (helps users with cognitive and motor impairments)**

Use `autocomplete` on inputs collecting personal data. WCAG 1.3.5 Identify Input Purpose.

**Incorrect: no autocomplete**

```tsx
<input type="text" name="fname" />
<input type="email" name="email" />
```

**Correct: autocomplete present**

```tsx
<input type="text" name="fname" autoComplete="given-name" />
<input type="email" name="email" autoComplete="email" />
```

Common values: `name`, `given-name`, `family-name`, `email`, `tel`, `street-address`, `postal-code`, `country`, `username`, `new-password`, `current-password`.

Autocomplete attributes work alongside [[forms-labels-required]] labels to help users fill forms efficiently.

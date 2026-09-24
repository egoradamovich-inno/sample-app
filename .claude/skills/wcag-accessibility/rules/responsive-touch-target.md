---
title: Minimum Touch Target Size
impact: LOW-MEDIUM
impactDescription: small targets cause errors for motor-impaired users
tags: responsive, touch-target, mobile, motor
related: [keyboard-interactive-elements]
---

## Minimum Touch Target Size

**Impact: LOW-MEDIUM (small targets cause errors for motor-impaired users)**

Interactive targets: minimum 24x24px, recommended 44x44px for primary actions. WCAG 2.5.8.

**Incorrect: tiny targets**

```css
.icon-btn { width: 16px; height: 16px; padding: 0; }
```

**Correct: adequate targets**

```css
.icon-btn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Tailwind:**

```tsx
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  <XIcon className="w-5 h-5" />
</button>
```

Exceptions: inline text links in sentences, elements with sufficient spacing between targets.

Touch targets must also be [[keyboard-interactive-elements]] — keyboard accessibility is required regardless of target size.

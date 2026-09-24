---
title: Respect prefers-reduced-motion
impact: MEDIUM
impactDescription: motion triggers vestibular disorders
tags: motion, reduced-motion, animation, css
related: [motion-safe-transitions, motion-no-autoplay]
---

## Respect prefers-reduced-motion

**Impact: MEDIUM (motion triggers vestibular disorders and seizures)**

Honor `prefers-reduced-motion` to disable or reduce animations. WCAG 2.3.3.

**Incorrect: animations always play**

```css
.card { transition: transform 0.3s ease; }
.panel { animation: slide-in 0.5s ease-out; }
```

**Correct: reduced motion respected**

```css
.card { transition: transform 0.3s ease; }
.panel { animation: slide-in 0.5s ease-out; }

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
  .panel { animation: none; }
}
```

**Tailwind:** `motion-safe:animate-bounce motion-reduce:animate-none`

**React hook:**

```tsx
function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return prefersReduced
}
```

For a safer default approach, [[motion-safe-transitions]] starts with no motion and adds it progressively. Auto-playing motion requires controls per [[motion-no-autoplay]].

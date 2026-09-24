---
title: Bundle Size Optimization
type: moc
impact: CRITICAL
description: Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.
---

# Bundle Size Optimization

Every kilobyte in the initial bundle delays Time to Interactive. The goal: load only what the user needs right now.

Start with imports — [[bundle-barrel-imports]] eliminates barrel file re-exports that pull in entire modules. For large components not needed on first render, [[bundle-dynamic-imports]] uses `next/dynamic` to lazy-load them on demand.

Third-party scripts like analytics deserve special treatment: [[bundle-defer-third-party]] delays their loading until after hydration. For features behind flags or toggles, [[bundle-conditional]] loads modules only when the feature activates.

To improve perceived performance without reducing bundle size, [[bundle-preload]] preloads dynamic imports on hover/focus so they're ready when clicked. Dynamic imports pair naturally with [[async-suspense-boundaries]] for showing loading states while chunks load.

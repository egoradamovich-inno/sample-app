---
title: Re-render Optimization
type: moc
impact: MEDIUM
description: Reducing unnecessary re-renders minimizes wasted computation and improves UI responsiveness.
---

# Re-render Optimization

React re-renders every time state changes. The goal: ensure components only re-render when their visible output actually changes.

The most impactful pattern is [[rerender-memo]] — extract expensive computations into memoized child components so the parent's re-renders don't cascade. Pair this with [[rendering-hoist-jsx]] from [[moc-rendering]] to avoid recreating static JSX on every render.

For state subscriptions, [[rerender-derived-state]] subscribes to derived booleans instead of raw objects (e.g., `items.length > 0` instead of the full array). Similarly, [[rerender-defer-reads]] avoids subscribing to state that's only used inside callbacks, not during render.

On the setState side, [[rerender-functional-setstate]] uses functional updaters for stable callback references, and [[rerender-lazy-state-init]] passes a function to `useState` to avoid re-computing expensive initial values. For effects, [[rerender-dependencies]] uses primitive dependencies instead of objects to prevent unnecessary re-fires.

For non-urgent UI updates, [[rerender-transitions]] wraps them in `startTransition` to keep the main thread responsive.

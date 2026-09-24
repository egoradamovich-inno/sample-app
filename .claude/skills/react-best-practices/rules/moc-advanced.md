---
title: Advanced Patterns
type: moc
impact: LOW
description: Advanced patterns for specific cases that require careful implementation.
---

# Advanced Patterns

These patterns solve specific problems around event handler stability and callback refs. They're powerful but require understanding of React's ref lifecycle.

[[advanced-event-handler-refs]] stores event handlers in refs to avoid re-attaching listeners when callbacks change. This is especially useful for [[client-event-listeners]] where re-subscribing to global events on every render is wasteful.

[[advanced-use-latest]] provides a `useLatest` hook that always holds the most recent value of a prop or state in a ref, enabling stable callback references. This eliminates the need for effect dependency arrays to track changing callbacks.

Both patterns trade directness for stability — use them when re-renders from callback changes cause measurable performance issues, not as defaults.

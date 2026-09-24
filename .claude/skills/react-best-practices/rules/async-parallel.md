---
title: Promise.all() for Independent Operations
impact: CRITICAL
impactDescription: 2-10× improvement
tags: async, parallelization, promises, waterfalls
related: [async-dependencies, server-parallel-fetching, async-defer-await]
---

## Promise.all() for Independent Operations

When async operations have no interdependencies, execute them concurrently using `Promise.all()`.

For operations with partial dependencies, see [[async-dependencies]] which uses `better-all` for fine-grained control. For server components, [[server-parallel-fetching]] applies the same principle through component composition.

**Incorrect (sequential execution, 3 round trips):**

```typescript
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()
```

**Correct (parallel execution, 1 round trip):**

```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

Before parallelizing, verify the await is necessary — [[async-defer-await]] can sometimes eliminate it entirely.

---
title: Server-Side Performance
type: moc
impact: HIGH
description: Optimizing server-side rendering and data fetching eliminates server-side waterfalls and reduces response times.
---

# Server-Side Performance

Server Components execute sequentially within a tree, creating server-side waterfalls that mirror client-side problems from [[moc-async]].

The primary fix is [[server-parallel-fetching]] — restructure component composition so sibling components fetch data simultaneously instead of sequentially. This is the server-side equivalent of [[async-parallel]].

For repeated data fetches within a request, [[server-cache-react]] uses `React.cache()` for per-request deduplication — call the same function anywhere in the tree and it executes only once. For data that stays valid across requests, [[server-cache-lru]] implements LRU caching with TTL-based expiration.

Minimize the client-server boundary cost with [[server-serialization]] — only pass the specific data client components need, not entire objects. For logging, analytics, and other side effects, [[server-after-nonblocking]] uses `after()` to run them without blocking the response.

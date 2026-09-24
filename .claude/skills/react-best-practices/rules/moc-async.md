---
title: Eliminating Waterfalls
type: moc
impact: CRITICAL
description: Waterfalls are the #1 performance killer. Each sequential await adds full network latency.
---

# Eliminating Waterfalls

Sequential awaits create request waterfalls — the single biggest performance problem in React apps. Each `await` adds a full network round-trip.

The most common fix is [[async-parallel]] — use `Promise.all()` to run independent operations concurrently (2-10× improvement). When operations have partial dependencies, [[async-dependencies]] shows how to use `better-all` for fine-grained parallelism.

Before parallelizing, check if the await is even needed — [[async-defer-await]] moves awaits into branches where they're actually used, avoiding blocking unused code paths. In API routes specifically, [[async-api-routes]] applies the same "start early, await late" pattern.

For component-level streaming, [[async-suspense-boundaries]] uses Suspense to show wrapper UI immediately while data loads. This connects to server-side patterns in [[moc-server]], especially [[server-parallel-fetching]] which restructures component composition for parallel data fetching.

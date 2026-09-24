---
title: JavaScript Performance
type: moc
impact: LOW-MEDIUM
description: Micro-optimizations for hot paths can add up to meaningful improvements.
---

# JavaScript Performance

These are general JavaScript optimizations — most impactful in hot loops, frequent callbacks, and data-heavy operations.

**Caching patterns** form the largest group. [[js-cache-property-access]] caches deeply nested property access in loops. [[js-cache-function-results]] uses module-level Maps to memoize pure function results. [[js-cache-storage]] caches `localStorage`/`sessionStorage` reads to avoid repeated synchronous I/O. These three patterns share a common principle — cache reads that don't change within a scope.

**Data structure choices** matter for lookups. [[js-index-maps]] builds a Map from arrays for O(1) repeated lookups instead of O(n) `find()` calls. [[js-set-map-lookups]] uses Set/Map for membership checks instead of `Array.includes()`.

**Iteration patterns** include [[js-combine-iterations]] (merge chained `filter().map()` into a single loop), [[js-length-check-first]] (check array length before expensive element comparisons), and [[js-min-max-loop]] (use a loop for min/max instead of sorting).

**Control flow** optimizations: [[js-early-exit]] returns early from functions to avoid deep nesting and unnecessary work — similar in spirit to [[async-defer-await]] which defers awaits. [[js-hoist-regexp]] hoists RegExp creation outside loops.

For immutable operations, [[js-tosorted-immutable]] uses `toSorted()` instead of `sort()` to avoid mutating the original array. For DOM updates, [[js-batch-dom-css]] groups CSS changes via classes or `cssText` to minimize reflows.

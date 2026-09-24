---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains 45 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## Navigation

Performance optimization begins with the highest-impact areas. The [[moc-async]] patterns eliminate request waterfalls — the #1 performance killer yielding 2-10× improvements. Equally critical, [[moc-bundle]] techniques reduce initial bundle size for faster Time to Interactive.

Server-side optimization via [[moc-server]] eliminates server waterfalls and reduces response times, while [[moc-client]] patterns handle efficient client-side data fetching with automatic deduplication.

For render-path optimization, [[moc-rerender]] minimizes wasted computation, and [[moc-rendering]] reduces browser rendering work. General [[moc-js]] micro-optimizations help on hot paths, and [[moc-advanced]] covers ref-based patterns for stable subscriptions.

For the complete guide with all rules expanded: `AGENTS.md`

---
title: Client-Side Data Fetching
type: moc
impact: MEDIUM-HIGH
description: Automatic deduplication and efficient data fetching patterns reduce redundant network requests.
---

# Client-Side Data Fetching

Client-side data fetching creates opportunities for redundant requests, especially when multiple components need the same data.

[[client-swr-dedup]] uses SWR for automatic request deduplication — when multiple components request the same data simultaneously, only one fetch fires. This is the client-side counterpart to [[server-cache-react]] on the server.

For DOM event handling, [[client-event-listeners]] shows how to deduplicate global event listeners (resize, scroll, etc.) that multiple components attach independently. When events don't need synchronous handling, [[client-passive-event-listeners]] marks them as passive to avoid blocking scrolling.

Schema validation for stored data ([[client-localstorage-schema]]) prevents crashes from stale localStorage formats after deployments — a common source of hard-to-reproduce production bugs.

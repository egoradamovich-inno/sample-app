---
title: Rendering Performance
type: moc
impact: MEDIUM
description: Optimizing the rendering process reduces the work the browser needs to do.
---

# Rendering Performance

After React decides what to render, the browser still needs to paint it. These patterns reduce that rendering work.

[[rendering-hoist-jsx]] extracts static JSX outside components to avoid recreating it on every render — this pairs with [[rerender-memo]] from [[moc-rerender]] for maximum effect. For conditional rendering, [[rendering-conditional-render]] uses ternary operators instead of `&&` to avoid rendering bugs with falsy values.

For long scrollable lists, [[rendering-content-visibility]] applies `content-visibility: auto` so the browser skips layout and paint for off-screen content. The [[rendering-activity]] component (React's built-in) hides/shows content while preserving its state.

SVG-specific optimizations include [[rendering-animate-svg-wrapper]] (animate a wrapping div instead of the SVG element for GPU acceleration) and [[rendering-svg-precision]] (reduce coordinate precision to shrink SVG size).

For SSR, [[rendering-hydration-no-flicker]] uses inline scripts to set client-only data (theme, locale) before hydration, preventing the flash of incorrect content.

---
title: Don't Auto-play Without User Control
impact: MEDIUM
impactDescription: auto-playing content is distracting and can cause seizures
tags: motion, autoplay, control
related: [motion-reduced-motion, media-video-captions]
---

## Don't Auto-play Without User Control

**Impact: MEDIUM (auto-playing content is distracting and can cause seizures)**

Moving content lasting more than 5 seconds must have pause/stop controls. WCAG 2.2.2 Pause, Stop, Hide.

**Incorrect: infinite auto-play**

```tsx
<div className="animate-marquee">Scrolling text...</div>
<video src="hero.mp4" autoPlay loop muted />
```

**Correct: user-controllable**

```tsx
function Banner() {
  const [paused, setPaused] = useState(false)
  return (
    <>
      <div className={paused ? '' : 'animate-marquee'}>Scrolling text...</div>
      <button onClick={() => setPaused(!paused)}>{paused ? 'Play' : 'Pause'}</button>
    </>
  )
}
```

Avoid content that flashes more than 3 times per second (WCAG 2.3.1).

Auto-playing content must respect [[motion-reduced-motion]] preferences. For video specifically, [[media-video-captions]] ensures the content is accessible when playing.

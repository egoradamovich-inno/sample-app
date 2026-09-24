# WCAG Accessibility Guidelines — Full Compiled Document

This document contains all 30 WCAG 2.2 Level AA accessibility rules expanded, organized by priority category. Use this as a single-file reference for comprehensive accessibility reviews.

---

## 1. Semantic HTML (CRITICAL)

Semantic HTML is the foundation of accessibility. Screen readers and assistive technologies rely on correct HTML semantics to convey structure and meaning.

### Use Correct Heading Hierarchy

**Impact: CRITICAL (screen readers use headings as navigation shortcuts)**

Headings must follow a logical hierarchy (h1 -> h2 -> h3). Skipping levels or using headings for styling breaks screen reader navigation. WCAG 1.3.1 Info and Relationships.

**Incorrect: skipping heading levels for styling**

```tsx
function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <h4>Recent Activity</h4>  {/* Skips h2, h3 */}
      <h2>Settings</h2>
      <h6>Advanced</h6>  {/* Skips h3, h4, h5 */}
    </div>
  )
}
```

**Correct: sequential heading levels**

```tsx
function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <h2>Recent Activity</h2>
      <h2>Settings</h2>
      <h3>Advanced</h3>
    </div>
  )
}
```

Use CSS classes for visual sizing instead of incorrect heading levels.

### Use Landmark Regions

**Impact: CRITICAL (enables screen reader landmark navigation)**

Use HTML5 landmark elements to define page regions. Screen readers provide shortcuts to jump between landmarks. WCAG 1.3.1, 2.4.1.

**Incorrect: div-only structure**

```tsx
function Layout() {
  return (
    <>
      <div className="header">...</div>
      <div className="sidebar">...</div>
      <div className="content">...</div>
      <div className="footer">...</div>
    </>
  )
}
```

**Correct: semantic landmarks**

```tsx
function Layout() {
  return (
    <>
      <header>...</header>
      <nav aria-label="Main">...</nav>
      <main>...</main>
      <aside aria-label="Related">...</aside>
      <footer>...</footer>
    </>
  )
}
```

When using multiple `nav` or `aside` elements, add `aria-label` to distinguish them.

### Use Button for Actions, Link for Navigation

**Impact: CRITICAL (conveys correct interaction model to assistive tech)**

Use `<button>` for in-page actions and `<a>` for navigation to URLs. Using `<div>` or `<span>` with onClick loses keyboard support and screen reader semantics. WCAG 4.1.2 Name, Role, Value.

**Incorrect: div as button**

```tsx
function Actions() {
  return (
    <>
      <div className="btn" onClick={handleSubmit}>Submit</div>
      <span onClick={() => setOpen(true)}>Open Menu</span>
      <a href="#" onClick={(e) => { e.preventDefault(); doAction() }}>Delete</a>
    </>
  )
}
```

**Correct: semantic elements**

```tsx
function Actions() {
  return (
    <>
      <button onClick={handleSubmit}>Submit</button>
      <button onClick={() => setOpen(true)}>Open Menu</button>
      <button onClick={doAction}>Delete</button>
      <a href="/settings">Go to Settings</a>
    </>
  )
}
```

If you must use a non-semantic element, add `role="button"`, `tabIndex={0}`, and keyboard handlers for Enter/Space. But prefer native elements.

### Use Proper List Structure

**Impact: HIGH (screen readers announce list length and item position)**

Use `<ul>`, `<ol>`, `<dl>` for lists of items. Screen readers announce "list, 5 items" and allow users to navigate by list items. WCAG 1.3.1.

**Incorrect: divs as list**

```tsx
function Nav() {
  return (
    <div className="menu">
      <div className="menu-item">Home</div>
      <div className="menu-item">About</div>
      <div className="menu-item">Contact</div>
    </div>
  )
}
```

**Correct: semantic list**

```tsx
function Nav() {
  return (
    <nav aria-label="Main">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  )
}
```

### Use Proper Table Markup

**Impact: HIGH (enables data table navigation with assistive tech)**

Use `<table>`, `<thead>`, `<tbody>`, `<th>` with `scope` for data tables. Screen readers use headers to announce cell context. WCAG 1.3.1.

**Incorrect: div grid as table**

```tsx
function UserTable({ users }) {
  return (
    <div className="grid">
      <div className="row header">
        <div>Name</div><div>Email</div><div>Role</div>
      </div>
      {users.map(u => (
        <div className="row" key={u.id}>
          <div>{u.name}</div><div>{u.email}</div><div>{u.role}</div>
        </div>
      ))}
    </div>
  )
}
```

**Correct: semantic table**

```tsx
function UserTable({ users }) {
  return (
    <table>
      <caption>Team members</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Email</th>
          <th scope="col">Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Use `role="presentation"` or `role="none"` on `<table>` only for layout tables (not data).

---

## 2. Keyboard & Focus (CRITICAL)

All functionality must be operable via keyboard alone. Many users cannot use a mouse and rely entirely on keyboard navigation.

### Ensure Visible Focus Indicators

**Impact: CRITICAL (keyboard users cannot navigate without visible focus)**

All interactive elements must have a visible focus indicator. Never remove outline without providing an alternative. WCAG 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured.

**Incorrect: removing focus outline**

```css
*:focus { outline: none; }
button:focus { outline: 0; }
```

**Correct: custom focus style**

```css
:focus-visible {
  outline: 2px solid #4A90D9;
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}
```

**Tailwind:**

```tsx
<button className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
  Click me
</button>
```

Use `:focus-visible` instead of `:focus` to show focus rings only for keyboard navigation.

### Maintain Logical Tab Order

**Impact: CRITICAL (unpredictable tab order confuses keyboard users)**

Tab order should follow visual reading order. Never use `tabindex` greater than 0. WCAG 2.4.3 Focus Order.

**Incorrect: positive tabindex creates unpredictable order**

```tsx
<input tabIndex={3} placeholder="Last" />
<input tabIndex={1} placeholder="First" />
<input tabIndex={2} placeholder="Middle" />
```

**Correct: rely on DOM order**

```tsx
<input placeholder="First" />
<input placeholder="Middle" />
<input placeholder="Last" />
```

Only use `tabindex="0"` (add to tab order) or `tabindex="-1"` (programmatic focus only). Reorder DOM instead of using positive tabindex values.

### Ensure Keyboard Accessibility for All Interactive Elements

**Impact: CRITICAL (100% of functionality must be keyboard operable)**

Every clickable element must be reachable and operable via keyboard. Custom widgets need keyboard event handlers. WCAG 2.1.1 Keyboard.

**Incorrect: mouse-only interactions**

```tsx
<div onClick={handleOpen}>Open Panel</div>
<img src="close.svg" onClick={handleClose} />
```

**Correct: keyboard-accessible interactions**

```tsx
<button onClick={handleOpen}>Open Panel</button>
<button onClick={handleClose} aria-label="Close">
  <img src="close.svg" alt="" />
</button>
```

For custom widgets that cannot use native elements, add `role`, `tabIndex={0}`, and `onKeyDown` handlers for Enter/Space.

### Implement Focus Trap in Modals

**Impact: HIGH (prevents keyboard users from getting lost behind modal)**

When a modal opens, focus must move into it and stay trapped until closed. On close, return focus to the trigger. WCAG 2.4.3 Focus Order.

**Incorrect: no focus management**

```tsx
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null
  return (
    <div className="overlay">
      <div className="modal">{children}<button onClick={onClose}>Close</button></div>
    </div>
  )
}
```

**Correct: native dialog with built-in focus trap**

```tsx
function Modal({ isOpen, onClose, children }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    isOpen ? dialog.showModal() : dialog.close()
  }, [isOpen])
  return (
    <dialog ref={dialogRef} onClose={onClose}>
      {children}
      <button onClick={onClose}>Close</button>
    </dialog>
  )
}
```

`<dialog>` with `showModal()` provides focus trapping, Escape key, and inert background automatically.

### Provide Skip Navigation Link

**Impact: MEDIUM (saves keyboard users from tabbing through repetitive navigation)**

Provide a "Skip to main content" link as the first focusable element. WCAG 2.4.1 Bypass Blocks.

**Incorrect: no skip link**

```tsx
function Layout() {
  return (
    <>
      <nav>{/* 20+ navigation links */}</nav>
      <main id="main">...</main>
    </>
  )
}
```

**Correct: skip link present**

```tsx
function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-2 focus:bg-white"
      >
        Skip to main content
      </a>
      <nav>{/* 20+ navigation links */}</nav>
      <main id="main" tabIndex={-1}>...</main>
    </>
  )
}
```

The link is visually hidden until focused via keyboard.

---

## 3. ARIA & Screen Readers (HIGH)

ARIA attributes bridge the gap between visual interfaces and assistive technologies, but must be used correctly to avoid making accessibility worse.

### Prefer Semantic HTML Over ARIA

**Impact: HIGH (native semantics are more robust than ARIA)**

Use native HTML elements before reaching for ARIA. First rule of ARIA: don't use ARIA if a native element works. WCAG 4.1.2.

**Incorrect: ARIA replicating native semantics**

```tsx
<div role="button" tabIndex={0} onClick={handleClick}>Submit</div>
<div role="navigation"><div role="list"><div role="listitem">Home</div></div></div>
<div role="heading" aria-level={2}>Section Title</div>
```

**Correct: native HTML elements**

```tsx
<button onClick={handleClick}>Submit</button>
<nav><ul><li><a href="/">Home</a></li></ul></nav>
<h2>Section Title</h2>
```

ARIA is only needed for custom widgets with no native equivalent (tabs, tree views, comboboxes).

### Provide Accessible Names for Interactive Elements

**Impact: HIGH (screen readers announce nothing for unlabeled controls)**

Every interactive element must have an accessible name via visible text, `aria-label`, or `aria-labelledby`. WCAG 4.1.2 Name, Role, Value.

**Incorrect: icon buttons without labels**

```tsx
<button onClick={onClose}><XIcon /></button>
<button onClick={onSearch}><SearchIcon /></button>
<a href="/profile"><img src="avatar.png" /></a>
```

**Correct: labeled interactive elements**

```tsx
<button onClick={onClose} aria-label="Close dialog"><XIcon aria-hidden="true" /></button>
<button onClick={onSearch} aria-label="Search"><SearchIcon aria-hidden="true" /></button>
<a href="/profile" aria-label="User profile"><img src="avatar.png" alt="" /></a>
```

Priority for accessible names: visible text > `aria-labelledby` > `aria-label` > `title`.

### Use aria-live for Dynamic Content

**Impact: HIGH (screen readers miss dynamic updates without live regions)**

When content updates dynamically (notifications, validation, loading), use `aria-live` to announce changes. WCAG 4.1.3 Status Messages.

**Incorrect: silent dynamic updates**

```tsx
function SearchResults({ results, loading }) {
  return (
    <div>
      {loading && <div>Loading...</div>}
      {results.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  )
}
```

**Correct: announced dynamic updates**

```tsx
function SearchResults({ results, loading }) {
  return (
    <div>
      <div aria-live="polite" aria-atomic="true">
        {loading ? 'Loading results...' : `${results.length} results found`}
      </div>
      {results.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  )
}
```

Use `aria-live="polite"` for status updates, `"assertive"` only for critical alerts. The live region element must exist in DOM before content changes.

### Don't Hide Interactive Content with aria-hidden

**Impact: HIGH (creates invisible but focusable ghost elements)**

Never apply `aria-hidden="true"` to elements containing focusable content. This creates elements users can tab to but not perceive. WCAG 4.1.2.

**Incorrect: hiding focusable content**

```tsx
<div aria-hidden="true">
  <button onClick={handleAction}>Click me</button>
  <a href="/page">Link</a>
</div>
```

**Correct: hide only decorative content**

```tsx
<button><SpinnerIcon aria-hidden="true" /> Loading...</button>

{/* Use inert for truly hidden interactive sections */}
<div inert={!isOpen}>
  <button onClick={handleAction}>Click me</button>
</div>
```

Use `inert` attribute or `dialog.showModal()` to properly remove both visibility and interactivity.

### Communicate Expandable Widget States

**Impact: MEDIUM-HIGH (AT users cannot perceive open/closed state without ARIA)**

Toggleable widgets (accordions, dropdowns, menus) must communicate state with `aria-expanded`. WCAG 4.1.2.

**Incorrect: no state communication**

```tsx
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <div onClick={() => setIsOpen(!isOpen)}>{title} {isOpen ? '▲' : '▼'}</div>
      {isOpen && <div>{children}</div>}
    </div>
  )
}
```

**Correct: ARIA states communicated**

```tsx
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false)
  const contentId = useId()
  return (
    <div>
      <button aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen(!isOpen)}>
        {title} <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>
      <div id={contentId} role="region" hidden={!isOpen}>{children}</div>
    </div>
  )
}
```

Also use `aria-expanded` for dropdown menus, disclosure widgets, and tree nodes.

---

## 4. Color & Contrast (HIGH)

Sufficient color contrast ensures content is readable for users with low vision, color blindness, or in challenging lighting conditions.

### Ensure Text Color Contrast

**Impact: HIGH (low contrast text is unreadable for low-vision users)**

Normal text: 4.5:1 contrast ratio. Large text (18px+ bold or 24px+): 3:1. WCAG 1.4.3.

**Incorrect: insufficient contrast**

```css
.subtitle { color: #ccc; background: #fff; } /* ~1.5:1 */
.muted { color: #999; background: #eee; }    /* ~2.3:1 */
input::placeholder { color: #ddd; }
```

**Correct: sufficient contrast**

```css
.subtitle { color: #595959; background: #fff; } /* ~7:1 */
.muted { color: #767676; background: #fff; }    /* ~4.5:1 */
input::placeholder { color: #767676; }
```

In Tailwind, `text-gray-500` on white passes AA, `text-gray-400` does not. Use browser DevTools Accessibility panel to verify.

### Don't Use Color as the Only Indicator

**Impact: HIGH (color-blind users cannot perceive color-only cues)**

Information conveyed by color must also be available through text, icons, or patterns. WCAG 1.4.1.

**Incorrect: color-only status**

```tsx
function Status({ isOnline }) {
  return <span style={{ color: isOnline ? 'green' : 'red' }}>●</span>
}
```

**Correct: color plus text**

```tsx
function Status({ isOnline }) {
  return (
    <span>
      <span style={{ color: isOnline ? 'green' : 'red' }} aria-hidden="true">●</span>
      {' '}{isOnline ? 'Online' : 'Offline'}
    </span>
  )
}
```

Common patterns: status badges use icons + text, chart lines use patterns + colors, links use underline + color, errors use icon + text + border.

### UI Component Contrast

**Impact: MEDIUM-HIGH (invisible UI boundaries make interfaces unusable)**

UI component boundaries and meaningful graphics need at least 3:1 contrast against adjacent colors. WCAG 1.4.11 Non-text Contrast.

**Incorrect: low-contrast UI**

```css
.input { border: 1px solid #e0e0e0; background: #fff; }
.btn-ghost { border: 1px solid #ddd; color: #ccc; }
```

**Correct: sufficient UI contrast**

```css
.input { border: 1px solid #767676; background: #fff; }
.btn-ghost { border: 1px solid #767676; color: #595959; }
```

Applies to: input borders, button boundaries, checkboxes, toggles, sliders, focus indicators, and meaningful icons.

---

## 5. Forms & Inputs (MEDIUM-HIGH)

Forms are critical interaction points. Proper labeling, error handling, and grouping enable all users to complete tasks successfully.

### Every Form Input Must Have a Label

**Impact: MEDIUM-HIGH (unlabeled inputs are invisible to screen readers)**

Every form control must have a visible, programmatically associated label. Placeholder is not a label. WCAG 1.3.1, 3.3.2.

**Incorrect: no associated label**

```tsx
<input type="email" placeholder="Email" />
<div className="label">Username</div>
<input type="text" />
```

**Correct: properly associated labels**

```tsx
<label htmlFor="email">Email</label>
<input id="email" type="email" placeholder="user@example.com" />

<label>
  Username
  <input type="text" />
</label>
```

Placeholder disappears on input, so it cannot serve as a label. Always use `<label>` with `htmlFor` or wrapping.

### Associate Error Messages with Inputs

**Impact: MEDIUM-HIGH (AT users cannot find errors without programmatic association)**

Error messages must be linked to their input fields programmatically. WCAG 3.3.1, 3.3.3.

**Incorrect: disconnected error**

```tsx
<input type="email" />
{error && <span className="text-red-500">{error}</span>}
```

**Correct: associated error**

```tsx
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && <span id="email-error" role="alert">{error}</span>}
```

Use `aria-describedby` to link error to input, `aria-invalid` to mark the field, `role="alert"` for dynamic announcements.

### Use Autocomplete Attributes

**Impact: MEDIUM (helps users with cognitive and motor impairments)**

Use `autocomplete` on inputs collecting personal data. WCAG 1.3.5 Identify Input Purpose.

**Incorrect: no autocomplete**

```tsx
<input type="text" name="fname" />
<input type="email" name="email" />
```

**Correct: autocomplete present**

```tsx
<input type="text" name="fname" autoComplete="given-name" />
<input type="email" name="email" autoComplete="email" />
```

Common values: `name`, `given-name`, `family-name`, `email`, `tel`, `street-address`, `postal-code`, `country`, `username`, `new-password`, `current-password`.

### Group Related Inputs with Fieldset

**Impact: MEDIUM (provides context for related form controls)**

Group related controls with `<fieldset>` and `<legend>`. Screen readers announce the legend before each control. WCAG 1.3.1, 3.3.2.

**Incorrect: ungrouped radio buttons**

```tsx
<p>Shipping method</p>
<label><input type="radio" name="shipping" value="standard" /> Standard</label>
<label><input type="radio" name="shipping" value="express" /> Express</label>
```

**Correct: fieldset with legend**

```tsx
<fieldset>
  <legend>Shipping method</legend>
  <label><input type="radio" name="shipping" value="standard" /> Standard</label>
  <label><input type="radio" name="shipping" value="express" /> Express</label>
</fieldset>
```

Use for: radio groups, checkbox groups, address sections, any group sharing a common label.

---

## 6. Media & Images (MEDIUM)

Non-text content must have text alternatives so information is available regardless of sensory abilities.

### Provide Meaningful Alt Text

**Impact: MEDIUM (images without alt are invisible to screen readers)**

Informative images must have alt text conveying the same information. WCAG 1.1.1.

**Incorrect: missing or unhelpful alt**

```tsx
<img src="chart.png" />
<img src="chart.png" alt="chart" />
<img src="team.jpg" alt="photo123.jpg" />
```

**Correct: meaningful alt text**

```tsx
<img src="chart.png" alt="Revenue grew 40% from Q1 to Q4 2025" />
<img src="team.jpg" alt="Engineering team at the annual offsite" />
```

Alt text should convey purpose and content, not describe every visual detail. For complex images, provide longer description via `aria-describedby`.

### Mark Decorative Images Correctly

**Impact: MEDIUM (decorative images announced by AT create noise)**

Purely decorative images must be hidden from assistive technologies. WCAG 1.1.1.

**Incorrect: decorative images announced**

```tsx
<img src="divider.svg" alt="decorative line" />
<button aria-label="Close"><img src="close.svg" alt="close icon" /></button>
```

**Correct: decorative images hidden**

```tsx
<img src="divider.svg" alt="" />
<button aria-label="Close"><img src="close.svg" alt="" /></button>
```

Use `alt=""` (empty string, not missing) to mark images as decorative. Icons inside labeled buttons should have `alt=""` to avoid redundancy.

### Provide Captions for Video Content

**Impact: MEDIUM (deaf users cannot access audio content)**

Pre-recorded video with audio must have synchronized captions. WCAG 1.2.2, 1.2.4.

**Incorrect: no captions**

```tsx
<video src="tutorial.mp4" controls />
```

**Correct: captions provided**

```tsx
<video controls>
  <source src="tutorial.mp4" type="video/mp4" />
  <track kind="captions" src="tutorial-en.vtt" srcLang="en" label="English" default />
</video>
```

Also provide text transcripts. Auto-generated captions are a starting point but should be reviewed for accuracy.

---

## 7. Motion & Animation (MEDIUM)

Motion can cause seizures, nausea, or distraction. Provide controls and respect user preferences for reduced motion.

### Respect prefers-reduced-motion

**Impact: MEDIUM (motion triggers vestibular disorders and seizures)**

Honor `prefers-reduced-motion` to disable or reduce animations. WCAG 2.3.3.

**Incorrect: animations always play**

```css
.card { transition: transform 0.3s ease; }
.panel { animation: slide-in 0.5s ease-out; }
```

**Correct: reduced motion respected**

```css
.card { transition: transform 0.3s ease; }
.panel { animation: slide-in 0.5s ease-out; }

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
  .panel { animation: none; }
}
```

**Tailwind:** `motion-safe:animate-bounce motion-reduce:animate-none`

**React hook:**

```tsx
function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return prefersReduced
}
```

### Don't Auto-play Without User Control

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

### Use Safe Defaults for Transitions

**Impact: LOW-MEDIUM (progressive enhancement prevents motion issues)**

Design with no-motion as default, enhance for users who haven't requested reduced motion. WCAG 2.3.3.

**Incorrect: motion as default**

```css
.panel { animation: slide-in 0.5s ease-out; }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
```

**Correct: no-motion default**

```css
.panel { /* No animation by default */ }
@media (prefers-reduced-motion: no-preference) {
  .panel { animation: slide-in 0.5s ease-out; }
}
```

Prefer `opacity` and `transform` as safer alternatives to layout-shifting animations. Fade transitions are safer than slide/bounce/zoom.

---

## 8. Responsive & Zoom (LOW-MEDIUM)

Content must remain usable when zoomed, resized, or viewed on different screen sizes and orientations.

### Text Must Be Resizable

**Impact: LOW-MEDIUM (low-vision users need to enlarge text)**

Text must be resizable up to 200% without loss of content. Use relative units. WCAG 1.4.4.

**Incorrect: fixed pixels**

```css
body { font-size: 14px; }
.heading { font-size: 24px; }
.container { max-width: 1200px; overflow: hidden; }
```

**Correct: relative units**

```css
html { font-size: 100%; }
body { font-size: 1rem; }
.heading { font-size: 1.5rem; }
.container { max-width: 75rem; overflow: visible; }
```

Avoid `overflow: hidden` on text containers. Test by zooming to 200%.

### Content Must Reflow at 320px Width

**Impact: LOW-MEDIUM (zoomed users see equivalent of 320px viewport)**

Content must reflow at 320px CSS width (400% zoom on 1280px). No horizontal scrolling except tables/images. WCAG 1.4.10 Reflow.

**Incorrect: fixed-width layout**

```css
.layout { display: flex; min-width: 1024px; }
.sidebar { width: 300px; flex-shrink: 0; }
```

**Correct: responsive layout**

```css
.layout { display: flex; flex-wrap: wrap; }
.sidebar { flex: 1 1 15rem; max-width: 20rem; }
.content { flex: 1 1 20rem; min-width: 0; }
```

Test by setting viewport to 320px or zooming to 400%.

### Minimum Touch Target Size

**Impact: LOW-MEDIUM (small targets cause errors for motor-impaired users)**

Interactive targets: minimum 24x24px, recommended 44x44px for primary actions. WCAG 2.5.8.

**Incorrect: tiny targets**

```css
.icon-btn { width: 16px; height: 16px; padding: 0; }
```

**Correct: adequate targets**

```css
.icon-btn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Tailwind:**

```tsx
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  <XIcon className="w-5 h-5" />
</button>
```

Exceptions: inline text links in sentences, elements with sufficient spacing between targets.

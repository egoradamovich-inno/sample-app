---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use when designing user interfaces, creating UI specifications, or styling web components. Triggers on "frontend design", "UI design", "user interface", "UX design", "style", "beautify". Generates creative, polished design that avoids generic AI aesthetics.
phase: planning
flow-next: writing-plans
flow-alternatives: [coder-frontend]
related: [api-designer, coder-frontend]
---

# Frontend Design

Create distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Focus on exceptional attention to aesthetic details and creative choices that make interfaces memorable.

## Generated File Naming Convention (MANDATORY)

**ANY file created by this skill MUST be prefixed with `frontend-design-`.**
Predefined output (`frontend-design-spec.md`) already follows this convention.
Any additional ad-hoc files (summaries, notes, mockup descriptions) MUST also follow this rule:
- ✅ `frontend-design-color-palette.md`
- ❌ `COLOR_PALETTE.md`

## Design Thinking Process

Before any implementation, understand the context and commit to a BOLD aesthetic direction:

### 1. Understand Context

- **Purpose**: What problem does this interface solve? Who uses it?
- **Audience**: Technical users, general consumers, enterprise, creative professionals?
- **Brand**: Does it need to match existing brand guidelines or is it greenfield?
- **Constraints**: Technical requirements (framework, performance, accessibility)

### 2. Choose Aesthetic Direction

Pick a clear conceptual direction and execute with precision. Options include:

| Direction              | Characteristics                                                  |
| ---------------------- | ---------------------------------------------------------------- |
| Brutally Minimal       | Maximum whitespace, essential elements only, stark contrasts     |
| Maximalist Chaos       | Dense information, overlapping elements, controlled visual noise |
| Retro-Futuristic       | Vintage sci-fi aesthetics, CRT effects, terminal vibes           |
| Organic/Natural        | Soft curves, nature-inspired colors, flowing layouts             |
| Luxury/Refined         | Premium materials, subtle animations, restrained elegance        |
| Playful/Toy-like       | Bright colors, bouncy animations, game-inspired elements         |
| Editorial/Magazine     | Strong typography hierarchy, grid-based, print-inspired          |
| Brutalist/Raw          | Exposed structure, unconventional layouts, anti-design           |
| Art Deco/Geometric     | Strong shapes, metallic accents, symmetrical patterns            |
| Industrial/Utilitarian | Functional-first, muted tones, no-nonsense clarity               |

**CRITICAL**: Bold maximalism and refined minimalism both work - the key is **intentionality**, not intensity.

### 3. Define Differentiation

Ask: What makes this UNFORGETTABLE? What's the one thing someone will remember?

## Aesthetic Guidelines

### Typography

**DO:**

- Choose fonts that are beautiful, unique, and interesting
- Pair a distinctive display font with a refined body font
- Use unexpected, characterful font choices that elevate the design
- Create clear hierarchy through size, weight, and spacing

**NEVER:**

- Default to generic fonts: Inter, Roboto, Arial, system fonts
- Use the same overused "safe" choices (Space Grotesk, etc.)
- Ignore font pairing - display and body fonts should complement

### Color & Theme

**DO:**

- Commit to a cohesive palette that matches the aesthetic direction
- Use CSS variables for consistency
- Apply dominant colors with sharp accents
- Vary between light and dark themes across designs

**NEVER:**

- Use timid, evenly-distributed palettes
- Default to cliché schemes (purple gradients on white backgrounds)
- Choose safe, forgettable color combinations

### Motion & Animation

**DO:**

- Focus on high-impact moments: orchestrated page load with staggered reveals
- Use scroll-triggering and hover states that surprise
- Create micro-interactions that delight
- Prefer CSS-only solutions for HTML, Motion library for React

**NEVER:**

- Scatter random animations without purpose
- Use generic fade-ins everywhere
- Ignore the timing and easing curves (they matter!)

### Spatial Composition

**DO:**

- Explore unexpected layouts: asymmetry, overlap, diagonal flow
- Use grid-breaking elements intentionally
- Apply generous negative space OR controlled density (match the aesthetic)
- Create visual rhythm through spacing patterns

**NEVER:**

- Default to predictable grid-only layouts
- Use cookie-cutter component patterns
- Ignore the relationship between elements

### Backgrounds & Visual Details

**DO:**

- Create atmosphere and depth (not just solid colors)
- Add contextual effects that match the aesthetic:
  - Gradient meshes, noise textures, geometric patterns
  - Layered transparencies, dramatic shadows
  - Decorative borders, custom cursors, grain overlays
- Use these elements to reinforce the design direction

**NEVER:**

- Leave backgrounds as flat solid colors by default
- Add effects that contradict the chosen aesthetic
- Use generic gradients without purpose

## Anti-Patterns: AI Slop to Avoid

These are signs of generic, forgettable AI-generated design:

- ❌ Overused font families (Inter, Roboto, Arial)
- ❌ Purple-to-blue gradients on white backgrounds
- ❌ Rounded rectangles with drop shadows everywhere
- ❌ Predictable card-based layouts
- ❌ Generic hero sections with stock-photo-style imagery
- ❌ Cookie-cutter component patterns
- ❌ Safe, forgettable color choices
- ❌ No context-specific character

## Design Deliverables

When creating a design specification:

```markdown
# [Feature] Frontend Design

## Aesthetic Direction

[Chosen direction and rationale]

## Key Design Decisions

- Typography: [Fonts and hierarchy]
- Color Palette: [Primary, secondary, accent colors]
- Motion: [Animation strategy]
- Layout: [Spatial approach]

## Memorable Element

[The one thing that makes this unforgettable]

## Component Visual Specs

[For each key component: visual description, states, interactions]

## Responsive Behavior

[How the design adapts across breakpoints]
```

## Quality Standard

Match implementation complexity to the aesthetic vision:

- **Maximalist designs** need elaborate code with extensive animations and effects
- **Minimalist designs** need restraint, precision, and careful attention to spacing, typography, and subtle details

Elegance comes from executing the vision well.

**Remember**: Claude is capable of extraordinary creative work. Don't hold back - show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

---

## Final Output (MANDATORY)

**Before presenting next steps, you MUST update the living specification:**

### Living Specification Update Process

1. **Read project context:**
   - Read `specs/MANIFEST.md` to understand the project overview
   - Read `specs/architect-architecture.md` to understand system architecture
   - Read `specs/api-designer-spec.md` to understand API contracts

2. **Read existing frontend spec:**
   - If `specs/frontend-design-spec.md` exists, read it to understand existing components and design system
   - If it doesn't exist, you'll create it using the structure from `../../../spec-desc.md`

3. **Get task number:**
   - If coming from previous skills, use the task number from context (e.g., "TASK-001")
   - Task number should be included in all section headers

4. **Update frontend-design-spec.md:**
   - **If file doesn't exist:** Create using the structure template from spec-desc.md, including:
     - Design System section (colors, typography, spacing)
     - Global theme configuration
     - Component library structure
   - **If file exists:** Append new components with `### [TASK-N] Component Name` prefix
   - Include date in section: `### [TASK-001] LoginForm (2026-01-22)`
   - Organize components by page/feature
   - Document:
     - Aesthetic direction and rationale
     - Typography choices (specific fonts, hierarchy)
     - Color palette (hex values, CSS variables)
     - Motion/animation strategy
     - Memorable element description
     - Component visual specs with states
     - Responsive behavior
   - Update global design tokens when adding new colors/fonts
   - Build design system incrementally

5. **Update MANIFEST.md if needed:**
   - Update "Last Updated" date for frontend-design-spec.md entry
   - Add new pages/features to "Key Decisions" section if applicable

**Example section in frontend-design-spec.md:**
```markdown
### [TASK-001] LoginForm (2026-01-22)

**Page:** Authentication

**Aesthetic:** Brutally Minimal - stark contrasts, essential elements only

**Typography:**
- Heading: Playfair Display, 32px
- Body: Inter, 16px

**Colors:**
- Background: #000000
- Accent: #FFFFFF
- Error: #FF0000

**Memorable Element:** Card tilts subtly toward cursor on hover

**States:**
- Default, Focused, Loading, Error

**Responsive:** Stack vertically on mobile < 768px
```

This incremental update ensures living documentation that grows with the project.

---

## Next Steps

After updating specs/frontend-design-spec.md and specs/MANIFEST.md, STOP and present these options:

**Next by flow:** [[/git-worktrees]] `[TASK-{N} context]` - Create isolated workspace for implementation. See [[moc-planning]] for phase context.

**Pass to next skill:** Include the task number in your context summary (e.g., "TASK-001: Login UI design documented")

**Alternatives:**
- [[/coder-frontend]] `[TASK-{N} context]` - Implement UI directly in current workspace.
- [[/brainstorm]] `[TASK-{N} context]` - Further refine the design through dialogue.

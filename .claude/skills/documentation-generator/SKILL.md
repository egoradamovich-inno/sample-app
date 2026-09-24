---
name: documentation-generator
description: Generate and maintain project documentation including READMEs, ADRs, changelogs, and code docs. Use when creating documentation, updating READMEs, writing ADRs, generating changelogs, or documenting modules/libraries. Triggers on "document", "README", "ADR", "changelog", "JSDoc", "update docs".
phase: finalization
flow-next: release
flow-alternatives: [finishing-branch]
related: [architect, api-designer]
---

# Documentation Generator

## Overview

Generate and maintain project documentation: READMEs, ADRs, changelogs, and JSDoc.

## Generated File Naming Convention (MANDATORY)

**ANY file created by this skill MUST be prefixed with `docs-generator-`.**
Predefined output (`docs-generator-implementation.md`) already follows this convention.
Any additional ad-hoc files (summaries, notes) MUST also follow this rule:
- ✅ `docs-generator-api-reference.md`
- ❌ `API_REFERENCE.md`

Standard project files (`README.md`, `CHANGELOG.md`) are exempt from this rule.

## Living Specification Updates

### specs/docs-generator-implementation.md

**Purpose:** Documents implementation details including build process, deployment, tooling, and development workflows.

**Update when:**
- Build configuration changes
- Deployment process changes
- Development tooling updates
- Environment setup changes

**Read context first:**
- Read `specs/MANIFEST.md` for project overview
- Read all other specs (architect-architecture, api-designer-spec, frontend-design-spec) for context
- Read source code to understand current implementation

**Structure template:** Use `../../../spec-desc.md` if creating from scratch

**Update pattern:** Append sections with `### [TASK-N] Feature Name` prefix

**Example section:**
```markdown
### [TASK-001] CI/CD Pipeline (2026-01-22)

**Pipeline:** GitHub Actions

**Steps:**
1. Lint
2. Test
3. Build
4. Deploy to staging

**Configuration:** `.github/workflows/deploy.yml`
```

## Documentation Types

### 1. Library README

```markdown
# @libs/<name>

## Overview
[1-2 sentences describing purpose]

## Installation
[If applicable]

## Usage

### Basic Usage
\`\`\`typescript
import { Something } from '@libs/<name>';
// Example code
\`\`\`

### Advanced Usage
[Additional patterns]

## API Reference

### `FunctionName`
[Description]

**Parameters:**
- `param1` (Type) - Description

**Returns:** Type - Description

**Example:**
\`\`\`typescript
// Usage example
\`\`\`

## Configuration
[Environment variables, options]

## Testing
\`\`\`bash
npx nx test <library-name>
\`\`\`
```

### 2. Domain README

```markdown
# @domains/<name>

## Overview
[Business domain description]

## Architecture

### Layers
- **Domain**: Entities, interfaces, errors
- **Application**: Commands, queries, handlers
- **Infrastructure**: Repositories
- **Presentation**: Controllers, DTOs

### Directory Structure
\`\`\`
src/
├── domain/
├── application/
├── infrastructure/
└── presentation/
\`\`\`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /resource | Create |
| GET | /resource/:id | Get by ID |

## Services
| Service | Purpose | Methods |
|---------|---------|---------|

## Controllers
| Controller | Endpoints | Purpose |
|------------|-----------|---------|

## Usage

### Creating a Resource
\`\`\`typescript
const resource = await resourceService.create({ ... });
\`\`\`
```

### 3. Architecture Decision Record (ADR)

```markdown
# ADR-NNNN: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What is the issue that we're seeing that is motivating this decision?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Drawback 1]
- [Drawback 2]

### Neutral
- [Neutral consequence]

## References
- [Link to relevant docs/discussions]
```

### 4. Changelog Entry

```markdown
## [Version] - YYYY-MM-DD

### Added
- New feature description

### Changed
- Changed behavior description

### Fixed
- Bug fix description

### Deprecated
- Feature that will be removed

### Removed
- Removed feature description
```

### 5. JSDoc Comments

```typescript
/**
 * Brief description of what this does.
 *
 * @description Longer description if needed.
 *
 * @param {Type} paramName - Parameter description
 * @returns {ReturnType} Description of return value
 * @throws {ErrorType} When this error occurs
 *
 * @example
 * ```typescript
 * const result = functionName(arg);
 * ```
 */
```

## Documentation Checklist

### New Library
- [ ] README.md with usage examples
- [ ] Exported API documented
- [ ] Index.ts exports all public API

### New Feature
- [ ] README updated
- [ ] ADR if architectural decision
- [ ] Changelog entry
- [ ] JSDoc for public functions

### Code Changes
- [ ] JSDoc updated if interface changed
- [ ] README updated if usage changed
- [ ] CLAUDE.md updated if new patterns

## CLAUDE.md Updates

When you discover new patterns:

```markdown
## [Pattern Name]

**When to use:** [Conditions]

**Structure:**
\`\`\`typescript
// Template code
\`\`\`

**Example:**
\`\`\`typescript
// Real implementation
\`\`\`
```

## Documentation Generation Process

1. **Read living specifications:**
   - Start with `specs/MANIFEST.md` for overview
   - Read all spec files (architect-architecture, api-designer-spec, frontend-design-spec) for context
   - Read source code to understand implementation

2. **Update all documentation:**
   - `specs/docs-generator-implementation.md` - Implementation details (build, deploy, tooling)
   - `README.md` - Project overview and setup
   - `CHANGELOG.md` - Version history
   - `docs/adrs/` - Architecture decisions
   - JSDoc - Code documentation
   - `CLAUDE.md` - Development patterns

3. **Ensure consistency:**
   - Cross-reference between docs
   - Update dates in MANIFEST.md
   - Keep examples accurate with current code

---

## Next Steps

After documentation is complete, STOP and present these options:

**Next by flow:** [[/release]] `[context]` - Create a release with changelog. See [[moc-finalization]] for phase context.

**Alternatives:**
- [[/finishing-branch]] `[context]` - Complete the branch directly without a release.
- [[/code-reviewer]] `[context]` - Review documentation accuracy before finishing.

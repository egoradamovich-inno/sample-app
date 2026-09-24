# accelerator-mini

> **Quick Start:** Jump to [Docker Development Setup](#docker-development-setup) for the fastest way to run the app.

A skill-based training/coaching platform: NestJS 11 backend + Prisma 6.19 + PostgreSQL 16; React 19 frontend + Vite 8 + Tailwind v4.

**Completed work:**
- **Epic-01:** User management & authentication (JWT + role-based access control; seed accounts for all roles)
- **TASK-009:** Containerized development environment (one-command `docker compose up` with hot-reload)

## Docker Development Setup

**Prerequisites:** Docker Desktop and Node.js 22+.

```bash
# Clone and install dependencies
git clone <repo-url>
cd accelerator-mini
npm install

# Start the containerized stack
npm run docker:up:build

# Open browser and log in
# http://localhost:5173
# Use any seed account (e.g., admin@example.com / Qwerty!)
```

**Convenience scripts:**

| Command | Purpose |
|---------|---------|
| `npm run docker:up` | Start existing containers (fast) |
| `npm run docker:up:build` | Rebuild images and start (first time) |
| `npm run docker:down` | Stop containers (preserves database) |
| `npm run docker:logs` | View live logs from all services |
| `npm run docker:reset-db` | Wipe database and reseed (full clean slate) |
| `npm run docker:seed` | Run database seeding in running container |

**Seed accounts (all password `Qwerty!`):**
- `admin@example.com` (SUPER_ADMIN)
- `trainer@example.com` (TRAINER)
- `coach@example.com` (COACH)
- `player@example.com` (PLAYER, adult family root)
- `child.player@example.com` (PLAYER, child linked to `player@example.com`)

**What happens on first `docker:up:build`:**
1. Postgres 16 starts on port 55432 (configurable via `POSTGRES_HOST_PORT` in `.env`)
2. NestJS backend builds and starts on port 3000, auto-runs migrations and seeding
3. React frontend builds and starts on port 5173 with hot-reload enabled
4. All services are ready within ~30 seconds

For more details, see [docs/adr/ADR-001-containerized-dev-environment.md](docs/adr/ADR-001-containerized-dev-environment.md) and [specs/docs-generator-implementation.md](specs/docs-generator-implementation.md).

---

# Accelerator Core

> **For agent policy rules, see [AGENTS.md](AGENTS.md)**

A skill-based extension framework for [Claude Code](https://docs.anthropic.com/claude-code) that adds structured workflows, specialized agents, and quality hooks to your development process.

## Directory Structure

```
.claude/
├── agents/          # Agent definitions (execute skills in isolation)
├── commands/        # Slash commands (user-invocable shortcuts)
├── hooks/           # Shell commands triggered by events
├── skills/          # Detailed skill implementations
├── settings.json    # Team configuration (permissions, hooks)
└── settings.local.json  # Personal settings (gitignored)
```

## Architecture: Command -> Agent -> Skill

The system uses a **manual flow** where each command runs in isolation and suggests the next step. This keeps context clean and prevents hallucination.

```
User runs: /requirements-analyst [prompt]
              │
              ▼
    ┌─────────────────────┐
    │   Command Spawns    │
    │   Agent             │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   Agent Executes    │
    │   Skill             │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   Output with       │
    │   Context Summary   │
    │   + Next Steps      │
    └─────────────────────┘
```

**Key Benefits:**
- Each command runs in isolated context (prevents hallucination)
- Context summaries allow handoff to next command
- User controls the flow (no automatic chaining)
- Main conversation stays clean

## Documentation System

### Temporary Task Docs (tasks/)
- Created by: requirements-analyst, brainstorming, writing-plans
- Location: `tasks/TASK-N/` (N auto-increments)
- Files: requirements-analyst-requirements.md, brainstorming-design.md, writing-plans-plan.md
- Lifecycle: Delete manually after implementation complete

### Living Specifications (specs/)
- Created/Updated by: architect, api-designer, frontend-design, docs-generator
- Location: `specs/` with MANIFEST.md index
- Files: architect-architecture.md, api-designer-spec.md, frontend-design-spec.md, docs-generator-implementation.md
- Updates: Append sections with [TASK-N] prefix
- Lifecycle: Permanent, grows with project

See spec-desc.md for specification structure template.

## Prerequisites

### Node.js & npm (required)

Node.js 18+ is required. npm comes bundled with Node.js.

```bash
# Check installed version
node -v && npm -v
```

Install from [nodejs.org](https://nodejs.org/) or via a version manager ([nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), [volta](https://volta.sh/)).

### GitHub CLI (required for `/release`, `/finishing-branch`, `/review-pr`, `/accelerator-update`)

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux (Debian/Ubuntu)
sudo apt install gh
```

After install, authenticate:

```bash
gh auth login
```

### Python 3 (required for `/release`, `/skill-creator`, `/accelerator-update`)

Python 3.8+ is used by internal scripts (changelog generation, version comparison, benchmarks).

```bash
# Check installed version
python3 --version
```

Install from [python.org](https://www.python.org/downloads/) or via package manager (`brew install python3`, `sudo apt install python3`).

### RTK + jq (optional, token savings 60-90%)

[RTK](https://github.com/rtk-ai/rtk) is a CLI proxy that compresses command output before it reaches the agent's context window. A PreToolUse hook automatically rewrites bash commands to RTK equivalents. If not installed, the hook silently passes through — nothing breaks.

```bash
# macOS
brew install rtk jq

# Windows
winget install --id jqlang.jq
# RTK: download binary from https://github.com/rtk-ai/rtk/releases
# and add to PATH

# Linux
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
sudo apt install jq
```

Verify:

```bash
rtk --version
jq --version
```

### Context7 CLI (optional, for up-to-date library docs)

Fetches current documentation for any library directly into the agent's context. Useful when writing code with APIs that may have changed since the model's training cutoff.

```bash
npm install -g ctx7@latest
ctx7 login                         # Optional — higher rate limits
```

Or run without installing: `npx ctx7@latest <command>`

### agent-browser CLI (required for `/browser-verify`)

```bash
npm install -g agent-browser
agent-browser install              # Downloads Chromium (first time only)
```

The agent-browser skill is already bundled in this repo at `.claude/skills/agent-browser/` — no separate skill installation needed.

## Quick Start

### Using Commands (Slash Commands)

Commands are shortcuts to invoke skills. Type `/` followed by the command name:

| Command                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `/requirements-analyst` | Analyze and decompose requirements                |
| `/brainstorm`           | Explore ideas and create designs through dialogue |
| `/writing-plans`        | Create detailed implementation plans              |
| `/architect`            | System architecture decisions                     |
| `/api-designer`         | REST API design with Swagger                      |
| `/git-worktrees`        | Create isolated workspaces                        |
| `/coder`                | Implement backend features                        |
| `/coder-frontend`       | Implement frontend features                       |
| `/browser-verify`       | Verify UI changes visually in the running app     |
| `/frontend-design`      | Create distinctive UI designs                     |
| `/code-reviewer`        | Code quality and best practices review            |
| `/test-generator`       | Generate unit, integration, and E2E tests         |
| `/debugger`             | Systematic debugging with root cause analysis     |
| `/release`              | Create GitHub release with changelog              |
| `/finishing-branch`     | Complete branch work and merge/PR                 |
| `/verify`               | Run DoD checklist and report pass/fail status     |
| `/docs-generator`       | Generate project documentation                    |
| `/reflect`              | Turn agent mistakes into permanent rules           |
| `/skill-creator`        | Create new skills                                 |
| `/accelerator-update`   | Update accelerator to latest version              |

**Example:**

```
/brainstorm user authentication with OAuth
```

### Context Handoff

Each command outputs a context summary. Pass this to the next command:

```
/brainstorm Design user authentication feature

[Agent completes and outputs context summary]

/writing-plans Based on auth design: JWT with refresh tokens,
  endpoints for login/logout/refresh, middleware for protected routes
```

## Skill Flow

See `.claude/skills/SKILL FLOW.md` for the complete visual diagram.

### Quick Reference: Next by Flow

| Current Command | Next by Flow | Why |
|-----------------|--------------|-----|
| `/requirements-analyst` | `/brainstorm` | Turn requirements into design |
| `/brainstorm` | `/architect` | Review architecture |
| `/architect` | `/api-designer` | Design APIs |
| `/api-designer` | `/frontend-design` | Design UI based on API |
| `/frontend-design` | `/writing-plans` | Create implementation tasks |
| `/writing-plans` | `/git-worktrees` | Create workspace |
| `/git-worktrees` | `/coder` or `/coder-frontend` | Start coding |
| `/coder` | `/code-reviewer` | Review code |
| `/coder-frontend` | `/browser-verify` or `/code-reviewer` | Verify UI or review code |
| `/browser-verify` | `/code-reviewer` | Review code after visual verify |
| `/code-reviewer` | `/test-generator` | Generate tests |
| `/test-generator` | `/debugger` or `/docs-generator` | Debug or update documentation |
| `/docs-generator` | `/release` or `/finishing-branch` | Create release or complete branch |
| `/release` | `/finishing-branch` | Complete the branch |
| `/finishing-branch` | (end) | Workflow complete |

## Skills

Skills are detailed instruction sets that define how Claude performs specific tasks.

### Skill Categories

#### Understanding Phase

| Skill                  | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `requirements-analyst` | Parse requirements from Confluence, decompose into tasks |
| `brainstorming`        | Explore ideas through dialogue, create designs           |

#### Planning Phase

| Skill                 | Purpose                              |
| --------------------- | ------------------------------------ |
| `architect`           | High-level architecture decisions    |
| `api-designer`        | REST API design, DTOs, Swagger docs  |
| `frontend-design`     | Create distinctive, production-grade UI |
| `writing-plans`       | Create granular implementation plans |

#### Implementation Phase

| Skill                 | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `using-git-worktrees` | Create isolated git worktrees                          |
| `coder`               | Backend implementation (Controller/Service/Repository) |
| `coder-frontend`      | Frontend implementation (React/Vue/Angular)            |
| `browser-verify`      | Visual verification of UI changes in the running app   |

#### Quality Phase

| Skill                            | Purpose                                    |
| -------------------------------- | ------------------------------------------ |
| `code-reviewer`                  | Code quality, security, performance review |
| `test-generator`                 | Generate comprehensive tests               |
| `systematic-debugger`            | Root cause analysis and debugging          |
| `verify`                         | Run DoD checklist, report pass/fail        |

#### Finalization Phase

| Skill                     | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `release`                 | Create GitHub release with changelog          |
| `finishing-branch`        | Complete branch work, create PR/merge         |
| `documentation-generator` | Generate project documentation                |

#### Utility

| Skill                | Purpose                              |
| -------------------- | ------------------------------------ |
| `reflect`            | Turn mistakes into permanent rules   |
| `skill-creator`      | Create new skills                    |
| `accelerator-update` | Update accelerator to latest version |

## Agents

Agents are workers that execute skills in isolation and return structured output.

### Agent Behavior

Every agent:
1. Uses the Skill tool to invoke its skill
2. Executes the skill completely
3. **STOPS** when done (no automatic chaining)
4. Provides:
   - **Context Summary**: 2-3 sentences of what was accomplished
   - **Next Steps**: Suggestions for next command

### Agent List

| Agent                           | Skill                          | Purpose                     |
| ------------------------------- | ------------------------------ | --------------------------- |
| `requirements-analyst-agent`    | requirements-analyst           | Parse requirements          |
| `brainstorming-agent`           | brainstorming                  | Design through dialogue     |
| `writing-plans-agent`           | writing-plans                  | Create implementation plans |
| `architect-agent`               | architect                      | Architecture decisions      |
| `api-designer-agent`            | api-designer                   | REST API design             |
| `using-git-worktrees-agent`     | using-git-worktrees            | Create isolated workspaces  |
| `coder-agent`                   | coder                          | Backend implementation      |
| `coder-frontend-agent`          | coder-frontend                 | Frontend implementation     |
| `browser-verify-agent`          | browser-verify                 | Visual UI verification      |
| `frontend-design-agent`         | frontend-design                | UI/UX design                |
| `code-reviewer-agent`           | code-reviewer                  | Code quality review         |
| `test-generator-agent`          | test-generator                 | Generate tests              |
| `systematic-debugger-agent`     | systematic-debugger            | Root cause analysis         |
| `verify-agent`                  | verify                         | Run DoD checklist           |
| `release-agent`                 | release                        | Create GitHub releases      |
| `finishing-branch-agent`        | finishing-branch               | Complete branch work        |
| `documentation-generator-agent` | documentation-generator        | Generate docs               |
| `reflect-agent`                 | reflect                        | Stabilize errors into rules |
| `skill-creator-agent`           | skill-creator                  | Create new skills           |
| `accelerator-update-agent`      | accelerator-update             | Update accelerator version  |

### Key Principle: Stop After Completion

Agents must:
- Execute ONLY their specific skill
- STOP when done
- NOT chain to other skills automatically
- NOT make workflow decisions

The **user** decides the next step based on suggestions.

## Hooks

Hooks are shell commands that execute in response to Claude Code events.

### Configured Hooks

| Hook                      | Trigger                  | Purpose                    |
| ------------------------- | ------------------------ | -------------------------- |
| `SessionStart`            | Session begins           | Project context scanner    |
| `PreToolUse:Write\|Edit`  | Before file modification | File naming validation     |
| `PreToolUse:Bash`         | Before bash command      | Destructive command guard  |
| `PostToolUse:Edit`        | After file edit          | Loop detection (7/10 edits)|
| `Notification`            | Permission/input needed  | Desktop notification       |

### Hook Return Codes

| Code | Meaning                         |
| ---- | ------------------------------- |
| `0`  | Success, continue               |
| `1`  | Failure, but continue (warning) |
| `2`  | Failure, block operation        |

See `.claude/hooks/README.md` for more examples.

## Settings

### Team Settings (`settings.json`)

Shared configuration committed to git:

```json
{
  "permissions": {
    "allow": ["Read(**)", "Edit(**)", "Bash(git:*)"],
    "deny": ["Read(.env)", "Bash(rm -rf:*)"]
  },
  "hooks": { ... }
}
```

### Personal Settings (`settings.local.json`)

Personal overrides (gitignored):

- Custom notifications
- Personal preferences
- Experimental features

## Creating New Skills

1. **Create skill directory**: `.claude/skills/<skill-name>/`
2. **Create SKILL.md** with frontmatter:

   ```markdown
   ---
   name: my-skill
   description: "What this skill does"
   ---

   # Skill Name

   ## Overview

   ...

   ---

   ## Next Steps

   After skill is complete, STOP and present these options:

   **Next by flow:** `/next-command [context]` - Why use this.

   **Alternatives:**
   - `/alt-command [context]` - Why use this.
   ```

3. **Create command** (optional): `.claude/commands/<skill-name>.md`
4. **Create agent** (optional): `.claude/agents/<skill-name>-agent.md`

Use `/skill-creator` for guided skill creation.

## Usage Examples

### Start a New Feature

```
/requirements-analyst Parse the user story for payment processing
```

After completion, agent suggests: `/brainstorm [context]`

```
/brainstorm Based on requirements: payment processing for subscriptions,
  supports Stripe/PayPal, needs webhooks for status updates
```

### Implementation Session

```
/coder Implement the PaymentService with Stripe integration
```

After completion, agent suggests: `/code-reviewer [context]`

```
/code-reviewer Review the PaymentService implementation in
  src/payment/payment.service.ts
```

### Debugging Session

```
/debugger Fix authentication token refresh not working
```

### Generate Tests

```
/test-generator Generate tests for PaymentService
```

### Complete Feature

```
/finishing-branch Complete payment feature branch
```

## Best Practices

1. **Follow the flow** - Use suggested next steps
2. **Pass context** - Include context summaries when calling next command
3. **Use git worktrees** for isolated development
4. **Verify before claiming completion** - Run tests and build
5. **Review code** before merging
6. **Keep skills focused** - One skill, one purpose

## Troubleshooting

### Skill not triggering?

- Check skill name matches exactly
- Verify SKILL.md frontmatter syntax
- Ensure skill directory exists

### Agent not stopping?

- Check agent constraints in agent file
- Verify skill has "Next Steps" section
- Report if agent chains automatically

### Context getting polluted?

- Use commands instead of asking directly
- Each command runs in isolated context
- Pass context summaries, not full history

## References

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [.claude/agents/](.claude/agents/) - Agent architecture details
- [.claude/hooks/README.md](.claude/hooks/README.md) - Hook configuration guide
- [.claude/skills/SKILL FLOW.md](.claude/skills/SKILL%20FLOW.md) - Skill flow diagram

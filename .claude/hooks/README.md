# Claude Code Hooks Documentation

## Active Hooks

### SessionStart: Local Context Scanner
**Script:** `local-context.sh`
**Purpose:** Outputs project context (git branch, package managers, available commands, project structure) at session start.
**Return:** Always 0 (informational only)

### PreToolUse (Write|Edit): File Naming Validator
**Script:** `file-naming-validator.sh`
**Purpose:** Validates that .md files in `tasks/` and `specs/` follow skill-prefix naming convention.
**Return:** 0 = valid name, 1 = warning (currently active), 2 = block (after tuning)
**Allowlist:** README.md, CHANGELOG.md, MANIFEST.md

### PreToolUse (Bash): Bash Validator
**Script:** `bash-validator.sh`
**Purpose:** Detects destructive commands: force-push, hard reset, DROP TABLE, npm publish, --no-verify.
**Return:** 0 = safe command, 1 = warning (currently active), 2 = block (after tuning)

### PostToolUse (Edit): Loop Detection
**Script:** `loop-detection.sh`
**Purpose:** Tracks edit count per file per session. Detects doom loops.
**Return:** 0 = normal, 1 = warning at 7 edits, 2 = block at 10 edits
**Tracking:** Uses `/tmp/claude-loop-detection/` (resets on reboot)

### Notification: Desktop Alert
**Purpose:** Desktop notification when Claude needs user attention.
**Variants:** WSL/PowerShell (active), macOS (osascript), Linux (notify-send)

## Hook Return Codes

| Code | Meaning |
|------|---------|
| `0` | Success, continue |
| `1` | Warning, continue (logged) |
| `2` | Block operation (shows error) |

## Tuning Strategy

All enforcement hooks start in **warn-only mode** (exit 1). After 1-2 weeks of observing behavior:
1. Review false positive rate
2. Adjust patterns/thresholds if needed
3. Switch to **block mode** (exit 2) for validated rules

## Hook Types

| Hook | When it fires |
|------|--------------|
| `SessionStart` | New Claude Code session |
| `Notification` | Claude needs user attention |
| `Stop` | Claude finishes responding |
| `PreToolUse` | Before a tool executes |
| `PostToolUse` | After a tool executes |

## Personal Hooks

Use `.claude/settings.local.json` for personal hooks that shouldn't be shared with the team.

## References

- [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)

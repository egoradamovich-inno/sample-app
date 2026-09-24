#!/bin/bash
# Bash Validator Hook
# Blocks destructive commands: force-push, hard reset, DROP TABLE, npm publish.
# Hook type: PreToolUse:Bash
# Exit codes: 0 = pass, 1 = warn (continue), 2 = block
#
# Currently in WARN mode (exit 1). Switch to exit 2 after tuning.

INPUT=$(cat)

# Extract command from JSON input (POSIX-compatible, no grep -P)
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# BLOCKED patterns — hard block (exit 2), truly destructive/irreversible
BLOCKED_PATTERNS=(
  "git push.*--force"
  "git push.*-f"
  "git reset --hard"
  "git clean -f"
  "DROP TABLE"
  "DROP DATABASE"
  "npm publish"
  "npx publish"
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "git branch -D"
  "--no-verify"
  "gh repo delete"
  "gh repo archive"
  "gh issue delete"
  "gh release delete"
  "gh api.*DELETE"
)

for PATTERN in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$PATTERN"; then
    echo "🚫 BLOCKED: Destructive command detected: matches pattern '$PATTERN'"
    echo "   Command: $COMMAND"
    echo "   This operation is blocked. See AGENTS.md."
    exit 2
  fi
done

exit 0

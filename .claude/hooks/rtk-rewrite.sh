#!/usr/bin/env bash
# RTK auto-rewrite hook for Claude Code PreToolUse:Bash
# Transparently rewrites raw commands to their RTK equivalents for token savings.
# Requires: rtk (>= 0.23.0) + jq. If missing, silently passes through.
#
# Exit code protocol for `rtk rewrite`:
#   0 + stdout  Rewrite found → auto-allow
#   1           No RTK equivalent → pass through unchanged
#   2           Deny rule matched → pass through
#   3 + stdout  Ask rule matched → rewrite but prompt user

# Guards: skip silently if dependencies missing
if ! command -v rtk &>/dev/null || ! command -v jq &>/dev/null; then
  exit 0
fi

set -euo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$CMD" ]; then
  exit 0
fi

# Skip heredocs
case "$CMD" in
  *'<<'*) exit 0 ;;
esac

# Rewrite via rtk
EXIT_CODE=0
REWRITTEN=$(rtk rewrite "$CMD" 2>/dev/null) || EXIT_CODE=$?

case $EXIT_CODE in
  0)
    # Rewrite found — auto-allow
    if [ "$CMD" = "$REWRITTEN" ]; then
      exit 0
    fi
    ;;
  1|2)
    # No equivalent or deny rule — pass through
    exit 0
    ;;
  3)
    # Ask rule — rewrite but let Claude Code prompt user
    ;;
  *)
    exit 0
    ;;
esac

# Build updated tool_input preserving all original fields
ORIGINAL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')
UPDATED_INPUT=$(echo "$ORIGINAL_INPUT" | jq --arg cmd "$REWRITTEN" '.command = $cmd')

if [ "$EXIT_CODE" -eq 3 ]; then
  jq -n \
    --argjson updated "$UPDATED_INPUT" \
    '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "updatedInput": $updated
      }
    }'
else
  jq -n \
    --argjson updated "$UPDATED_INPUT" \
    '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow",
        "permissionDecisionReason": "RTK auto-rewrite",
        "updatedInput": $updated
      }
    }'
fi

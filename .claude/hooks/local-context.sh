#!/bin/bash
# Local Context Session Start Hook
# Scans working directory at session start to provide project context.
# Hook type: SessionStart
# Exit codes: always 0 (informational only)

echo "📋 Project Context"
echo "=================="

# Git info
if git rev-parse --git-dir > /dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  STATUS=$(git status --short 2>/dev/null | wc -l)
  echo "Branch: $BRANCH ($STATUS uncommitted changes)"
fi

# Package managers
MANAGERS=""
[ -f "package-lock.json" ] && MANAGERS="$MANAGERS npm"
[ -f "yarn.lock" ] && MANAGERS="$MANAGERS yarn"
[ -f "pnpm-lock.yaml" ] && MANAGERS="$MANAGERS pnpm"
[ -f "bun.lockb" ] && MANAGERS="$MANAGERS bun"
[ -n "$MANAGERS" ] && echo "Package managers:$MANAGERS"

# Available commands
if [ -f "package.json" ]; then
  SCRIPTS=$(node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join(', '))" 2>/dev/null)
  [ -n "$SCRIPTS" ] && echo "Root scripts: $SCRIPTS"
fi
if [ -f "backend/package.json" ]; then
  SCRIPTS=$(node -e "const p=require('./backend/package.json'); console.log(Object.keys(p.scripts||{}).join(', '))" 2>/dev/null)
  [ -n "$SCRIPTS" ] && echo "Backend scripts: $SCRIPTS"
fi
if [ -f "frontend/package.json" ]; then
  SCRIPTS=$(node -e "const p=require('./frontend/package.json'); console.log(Object.keys(p.scripts||{}).join(', '))" 2>/dev/null)
  [ -n "$SCRIPTS" ] && echo "Frontend scripts: $SCRIPTS"
fi
[ -f "nx.json" ] && echo "Build system: Nx"
[ -f "Makefile" ] && echo "Build system: Make"

# Project structure
echo ""
echo "Structure:"
for DIR in backend frontend tasks specs examples .claude; do
  if [ -d "$DIR" ]; then
    COUNT=$(find "$DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
    echo "  $DIR/ ($COUNT files)"
  fi
done

# Task and spec counts
if [ -d "tasks" ]; then
  TASK_COUNT=$(find tasks -maxdepth 1 -type d -name "TASK-*" 2>/dev/null | wc -l)
  echo "  Tasks: $TASK_COUNT"
fi
if [ -d "specs" ]; then
  SPEC_COUNT=$(find specs -maxdepth 1 -type f -name "*.md" ! -name "MANIFEST.md" 2>/dev/null | wc -l)
  echo "  Specs: $SPEC_COUNT"
fi

exit 0

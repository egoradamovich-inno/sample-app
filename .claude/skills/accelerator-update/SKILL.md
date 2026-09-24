---
name: accelerator-update
description: Update accelerator-core installation to the latest version from GitHub. Use when the user wants to check for updates, update the accelerator, or upgrade to a newer version. Handles version checking, changelog display, selective file updates with user customization preservation, and post-update verification.
phase: utility
flow-alternatives: []
related: []
---

# Accelerator Update

## Overview

Update the accelerator-core installation by fetching the latest release from GitHub, comparing versions, and selectively applying updates while preserving user customizations.

## Generated File Naming Convention (MANDATORY)

**ANY file created by this skill MUST be prefixed with `accelerator-update-`:**
- ✅ `accelerator-update-changelog.md`, `accelerator-update-diff.txt`
- ❌ `CHANGELOG.md`, `UPDATE_DIFF.txt`

This applies to ALL generated files.

**Announce at start:** "I'm using the accelerator-update skill to update the accelerator installation."

## The Update Process

### Step 1: Check Current Version

Read `.claude/.accelerator-version` file:

```bash
cat .claude/.accelerator-version
```

**If file doesn't exist:**
Report: "No version info found. This might be a manual installation. Cannot determine current version."
Ask user if they want to proceed anyway. **Use AskUserQuestion tool.**

**If file exists:**
Store the version (e.g., `1.2.0` or `v1.2.0`).

### Step 2: Determine Repository

Read `.claude/.accelerator-repo` file to get the repository name:

```bash
cat .claude/.accelerator-repo 2>/dev/null || echo ""
```

**If file doesn't exist or is empty:**
Ask user for repository name. **Use AskUserQuestion tool.**
```
What is the GitHub repository for the accelerator?
Format: owner/repo (e.g., "acme/accelerator-core")
```

Store the repository name for all subsequent operations.

### Step 3: Check Latest Version

Fetch latest release information:

```bash
gh release list --repo <REPO> --limit 1
gh release view --repo <REPO> --json tagName,body,publishedAt
```

**If `gh` command fails:**
Report: "GitHub CLI (gh) is not available or not authenticated. Please install and authenticate gh CLI first."
Stop execution.

**Parse the response to extract:**
- Latest version tag (e.g., `v1.3.0`)
- Release body (changelog/notes)
- Published date

### Step 4: Compare Versions

Use the version comparison script:

```bash
python3 .claude/skills/accelerator-update/scripts/compare_versions.py "<current>" "<latest>"
```

**Result interpretation:**
- `newer`: Update available
- `same`: Already up to date
- `older`: Current version is newer (unusual, possibly custom build)

**If `same`:**
Report: "Already running the latest version (<version>). No update needed."
Stop execution.

**If `older`:**
Report: "Current version (<current>) is newer than latest release (<latest>). This might be a custom build."
Ask if user wants to proceed. **Use AskUserQuestion tool.**

**If `newer`:**
Continue to Step 5.

### Step 5: Display Changelog

Show user what's new:

```
Update available:
- Current: v<X.X.X>
- Latest: v<Y.Y.Y>
- Published: <date>

What's new:
<release body from GitHub>
```

### Step 6: Get User Confirmation

Present options. **Use AskUserQuestion tool.**

```
How would you like to proceed?

1. Update now (recommended)
2. Show diff of changes first
3. Skip this update

Which option?
```

**If option 3 (Skip):**
Report: "Update skipped. Run /accelerator-update again when ready."
Stop execution.

**If option 2 (Show diff):**
Continue to Step 6a, then return to this step.

**If option 1 (Update now):**
Continue to Step 7.

### Step 6a: Show Diff Preview

Download the release to a temporary location:

```bash
mkdir -p /tmp/accelerator-update-preview
cd /tmp/accelerator-update-preview
gh release download <tag> --repo <REPO> --pattern "*.tar.gz"
tar -xzf *.tar.gz
```

Compare with current installation:

```bash
# List what would be added
find /tmp/accelerator-update-preview/.claude -type f | while read file; do
  local_file="${file#/tmp/accelerator-update-preview/}"
  if [ ! -f "$local_file" ]; then
    echo "ADD: $local_file"
  fi
done

# List what would be modified
find /tmp/accelerator-update-preview/.claude -type f | while read file; do
  local_file="${file#/tmp/accelerator-update-preview/}"
  if [ -f "$local_file" ]; then
    if ! diff -q "$file" "$local_file" >/dev/null 2>&1; then
      echo "MODIFY: $local_file"
    fi
  fi
done
```

Save the output to `accelerator-update-diff.txt` for user review.

Show summary:
```
Files that would be added: <count>
Files that would be modified: <count>
Files that would be preserved: <count>

See accelerator-update-diff.txt for full details.
```

Return to Step 6 for confirmation.

### Step 7: Backup Current Installation (Optional)

Ask user if they want a backup. **Use AskUserQuestion tool.**

```
Create a backup before updating?
This creates .claude.backup.<timestamp> directory.

yes/no?
```

**If yes:**
```bash
cp -r .claude .claude.backup.$(date +%Y%m%d_%H%M%S)
```

Report backup location.

### Step 8: Download and Extract Update

```bash
mkdir -p /tmp/accelerator-update
cd /tmp/accelerator-update
gh release download <tag> --repo <REPO> --pattern "*.tar.gz"
tar -xzf *.tar.gz
```

Verify extraction:
```bash
ls -la /tmp/accelerator-update/.claude/
```

### Step 9: Apply Update Selectively

Follow the update strategy from `references/update_strategy.md`:

#### 9.1: Update Core Files (Overwrite)

```bash
# Skills
rm -rf .claude/skills
cp -r /tmp/accelerator-update/.claude/skills .claude/

# Agents
rm -rf .claude/agents
cp -r /tmp/accelerator-update/.claude/agents .claude/

# Commands
rm -rf .claude/commands
cp -r /tmp/accelerator-update/.claude/commands .claude/
```

#### 9.2: Merge Settings

```bash
python3 .claude/skills/accelerator-update/scripts/merge_settings.py \
  .claude/settings.json \
  /tmp/accelerator-update/.claude/settings.json \
  .claude/settings.json.merged

mv .claude/settings.json.merged .claude/settings.json
```

Never touch `settings.local.json` if it exists.

#### 9.3: Handle Hooks

```bash
# Check for new hooks
find /tmp/accelerator-update/.claude/hooks -type f 2>/dev/null | while read hook; do
  local_hook="${hook#/tmp/accelerator-update/}"
  if [ ! -f "$local_hook" ]; then
    echo "Adding new hook: $local_hook"
    cp "$hook" "$local_hook"
  else
    # Hook exists locally, check if different
    if ! diff -q "$hook" "$local_hook" >/dev/null 2>&1; then
      echo "Hook differs: $local_hook"
      # Show diff and ask user
    fi
  fi
done
```

For modified hooks, ask user. **Use AskUserQuestion tool.**

#### 9.4: Update Version Files

```bash
cp /tmp/accelerator-update/.claude/.accelerator-version .claude/
echo "<REPO>" > .claude/.accelerator-repo
```

### Step 10: Verify Update

Check that update completed successfully:

```bash
# Verify version file
cat .claude/.accelerator-version

# Verify core directories exist
ls -d .claude/skills .claude/agents .claude/commands

# Verify settings is valid JSON
python3 -m json.tool .claude/settings.json > /dev/null
```

### Step 11: Report Results

Generate update summary in `accelerator-update-summary.md`:

```markdown
# Accelerator Update Summary

**Updated:** <timestamp>
**From:** v<old> → **To:** v<new>

## Files Updated

### Added (<count>)
- .claude/skills/new-skill/SKILL.md
- ...

### Modified (<count>)
- .claude/agents/existing-agent.md
- ...

### Preserved
- .claude/settings.local.json (user file)
- .claude/skills/my-custom-skill/ (user skill)
- ...

## Changelog

<release notes from GitHub>

## Backup

Created backup at: .claude.backup.<timestamp>
```

Display summary to user and report success.

### Step 12: Show Post-Update Notes

If release notes contain breaking changes or migration instructions, highlight them:

```
⚠️ Breaking Changes:
<extract breaking changes from release notes>

📋 Migration Required:
<extract migration instructions>
```

### Step 13: Cleanup

```bash
rm -rf /tmp/accelerator-update /tmp/accelerator-update-preview
```

## Quick Reference

| Step | Action | Tool |
|------|--------|------|
| 1 | Check current version | Read file |
| 2 | Get repository | Read file or ask |
| 3 | Fetch latest | `gh release` |
| 4 | Compare versions | Python script |
| 5 | Show changelog | Display |
| 6 | Get confirmation | AskUserQuestion |
| 7 | Backup | Optional, cp |
| 8 | Download | `gh release download` |
| 9 | Apply update | Selective copy/merge |
| 10 | Verify | Check files/version |
| 11 | Report | Generate summary |
| 12 | Post-update notes | Display warnings |
| 13 | Cleanup | rm temp files |

## Red Flags

**Never:**
- Proceed with update without user confirmation
- Overwrite `settings.local.json` (always preserve)
- Delete user's custom skills or files
- Force update if version comparison fails
- Skip verification step
- Lose user's hook customizations without asking
- Continue if `gh` CLI is not available

## Resources

### scripts/compare_versions.py

Compare semantic versions (e.g., `v1.2.3` vs `v1.3.0`).

**Usage:**
```bash
python3 scripts/compare_versions.py "1.2.0" "1.3.0"
# Output: newer | same | older
```

### scripts/merge_settings.py

Merge settings.json files, preserving user customizations.

**Usage:**
```bash
python3 scripts/merge_settings.py current.json new.json output.json
```

User values take precedence. New keys from update are added.

### references/update_strategy.md

Detailed documentation on how different file types are handled during updates. Read this for understanding the merge strategy and conflict resolution.

## Next Steps

After update completes, this is a standalone operation.

**Suggested follow-ups:**
- Review `accelerator-update-summary.md` to see what changed
- Test updated skills by using their commands
- Check release notes for breaking changes or new features

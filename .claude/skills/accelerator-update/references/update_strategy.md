# Update Strategy

This document details how different file types are handled during accelerator updates.

## File Handling Rules

### Core Files (OVERWRITE)

These are managed by the accelerator and should be completely replaced:

- `skills/` - All skill directories and SKILL.md files
- `agents/` - All agent definition files
- `commands/` - All command files
- `.accelerator-version` - Version file
- `.accelerator-repo` - Repository reference

**Action:** Replace entirely with new version.

### Configuration Files (MERGE)

These may contain user customizations and should be merged:

- `settings.json` - Main settings (merge, user values take precedence)
- `settings.local.json` - Never overwrite (user-specific)

**Action:** Use `scripts/merge_settings.py` to preserve user customizations.

### Hook Files (PRESERVE USER, ADD NEW)

These may contain user customizations:

- `hooks/` directory - User may have added custom hooks

**Strategy:**
1. If accelerator adds new hooks not present locally, add them
2. If user has modified existing hooks, preserve user version
3. Show diff for modified hooks and ask user if they want to update

### Custom Files (PRESERVE)

Any files/directories in `.claude/` not present in the accelerator:

- User-created skills
- Custom commands
- Any other user files

**Action:** Never touch these files.

## Backup Strategy

Before updating, optionally create backup:

```bash
cp -r .claude .claude.backup.$(date +%Y%m%d_%H%M%S)
```

Backup can be deleted after successful update or kept for rollback.

## Conflict Resolution

When files conflict:

1. Core files: Always use new version
2. Settings: Merge with user values prioritized
3. Hooks: Show diff, let user decide
4. Custom files: Never touch

## Verification After Update

After update completes:

1. Verify `.claude/.accelerator-version` matches expected version
2. Check that all core directories exist
3. Verify settings.json is valid JSON
4. List what was updated for user review

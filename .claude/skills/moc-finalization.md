---
title: Finalization Phase
type: moc
phase: 4
description: Update documentation and create releases after code is complete.
---

# Finalization Phase

The fourth phase documents the work from [[moc-execution]] and publishes releases. It updates living documentation and creates versioned GitHub releases.

## Commands

[[/docs-generator]] generates and maintains project documentation including READMEs, ADRs (Architecture Decision Records), changelogs, and code documentation (JSDoc).

[[/release]] creates GitHub releases with automated changelog generation from git commits, version tagging, and publication.

[[/finishing-branch]] completes the branch by presenting structured options for merge, PR, or cleanup. While primarily an [[moc-execution]] command, it is the final step after release.

## Flow

The default path is [[/docs-generator]] then [[/release]] then [[/finishing-branch]]. If no release is needed, [[/docs-generator]] can go directly to [[/finishing-branch]].

## Outputs

- Updated `README.md`, ADRs in `docs/adr/`, and JSDoc annotations
- `CHANGELOG.md` updates
- GitHub release with auto-generated changelog

## Previous Phase

Returns from [[moc-execution]] when all tests pass and code review is complete.

---
spawns: accelerator-update-agent
phase: utility
flow-next:
flow-alternatives: []
---

# Accelerator Update

Spawn accelerator-update agent to update the accelerator installation.

## Input
$ARGUMENTS

## Instructions

Use the Task tool to spawn a sub-agent:
- **subagent_type:** `accelerator-update`
- **description:** `Update accelerator installation`
- **prompt:** `$ARGUMENTS`

The agent will use the accelerator-update skill and report results when done.

#!/usr/bin/env python3
"""Merge settings.json files, preserving user customizations."""

import json
import sys
from pathlib import Path
from typing import Any, Dict


def deep_merge(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep merge two dictionaries.

    Updates base with values from updates, but preserves base values
    for keys not in updates.
    """
    result = base.copy()

    for key, value in updates.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value

    return result


def merge_settings(current_path: str, new_path: str, output_path: str) -> None:
    """
    Merge settings files, preserving user customizations.

    Args:
        current_path: Path to current settings.json
        new_path: Path to new settings.json from update
        output_path: Path to write merged settings.json
    """
    # Read current settings
    current = {}
    if Path(current_path).exists():
        with open(current_path, 'r') as f:
            current = json.load(f)

    # Read new settings
    new = {}
    if Path(new_path).exists():
        with open(new_path, 'r') as f:
            new = json.load(f)

    # Merge with current taking precedence
    merged = deep_merge(new, current)

    # Write merged result
    with open(output_path, 'w') as f:
        json.dump(merged, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: merge_settings.py <current_settings> <new_settings> <output_path>")
        sys.exit(1)

    merge_settings(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f"Settings merged successfully to {sys.argv[3]}")

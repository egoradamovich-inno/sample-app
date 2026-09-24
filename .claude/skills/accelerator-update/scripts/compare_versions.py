#!/usr/bin/env python3
"""Compare semantic versions."""

import sys
from typing import Tuple


def parse_version(version: str) -> Tuple[int, int, int]:
    """Parse version string like 'v1.2.3' or '1.2.3' into tuple (1, 2, 3)."""
    version = version.lstrip('v')
    parts = version.split('.')
    try:
        return tuple(int(p) for p in parts[:3])
    except (ValueError, IndexError):
        return (0, 0, 0)


def compare_versions(current: str, latest: str) -> str:
    """
    Compare two semantic versions.

    Returns:
        'newer' if latest > current
        'same' if latest == current
        'older' if latest < current
    """
    current_tuple = parse_version(current)
    latest_tuple = parse_version(latest)

    if latest_tuple > current_tuple:
        return 'newer'
    elif latest_tuple == current_tuple:
        return 'same'
    else:
        return 'older'


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: compare_versions.py <current_version> <latest_version>")
        sys.exit(1)

    result = compare_versions(sys.argv[1], sys.argv[2])
    print(result)

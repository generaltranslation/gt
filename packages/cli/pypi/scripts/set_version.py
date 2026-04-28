#!/usr/bin/env python3
"""Set gtx_cli.__version__ from the released npm package version."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <version>", file=sys.stderr)
        raise SystemExit(2)

    version = sys.argv[1]
    init_path = Path(__file__).resolve().parents[1] / "gtx_cli" / "__init__.py"
    text = init_path.read_text(encoding="utf-8")
    updated = re.sub(r'__version__\s*=\s*"[^"]*"', f'__version__ = "{version}"', text)

    if updated == text:
        print(f"Could not find __version__ assignment in {init_path}", file=sys.stderr)
        raise SystemExit(1)

    init_path.write_text(updated, encoding="utf-8")
    print(f"Set gtx-cli version to {version}")


if __name__ == "__main__":
    main()

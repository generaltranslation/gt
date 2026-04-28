#!/usr/bin/env python3
"""Set __version__ in gtx_cli/__init__.py from an argument."""
import re
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <version>", file=sys.stderr)
        sys.exit(1)

    version = sys.argv[1]
    init_path = Path(__file__).resolve().parent.parent / "gtx_cli" / "__init__.py"
    text = init_path.read_text()
    text = re.sub(r'__version__\s*=\s*"[^"]*"', f'__version__ = "{version}"', text)
    init_path.write_text(text)
    print(f"Set gtx_cli version to {version}")


if __name__ == "__main__":
    main()

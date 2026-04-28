"""Run the bundled General Translation CLI binary for this platform."""

from __future__ import annotations

import os
import platform
import stat
import subprocess
import sys
from pathlib import Path


def _ensure_executable(path: Path) -> None:
    """Ensure a bundled Unix binary has executable mode bits."""
    if sys.platform == "win32":
        return

    current_mode = path.stat().st_mode
    executable_bits = stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    if current_mode & executable_bits != executable_bits:
        path.chmod(current_mode | executable_bits)


def _bundled_binary() -> Path:
    """Return the bundled CLI binary path for this platform-specific wheel."""
    binary_name = "gt.exe" if sys.platform == "win32" else "gt"
    binary_path = Path(__file__).resolve().parent / "bin" / binary_name

    if not binary_path.is_file():
        raise RuntimeError(
            f"bundled CLI binary not found for {platform.system()}-{platform.machine()}: {binary_path}"
        )
    _ensure_executable(binary_path)
    return binary_path


def main() -> None:
    """Run the bundled CLI binary with the current process arguments."""
    try:
        binary = _bundled_binary()
    except Exception as exc:
        print(f"gtx-cli: failed to locate bundled CLI binary: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    argv = [str(binary), *sys.argv[1:]]
    if sys.platform == "win32":
        result = subprocess.run(argv)
        raise SystemExit(result.returncode)

    os.execv(str(binary), argv)

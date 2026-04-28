"""
Download (if needed) and run the gt CLI binary.

The binary is a Bun-compiled standalone executable hosted on Cloudflare R2.
We cache it in a platform-appropriate directory so subsequent runs are instant.
"""

from __future__ import annotations

import os
import platform
import stat
import subprocess
import sys
import tempfile
import urllib.request

# R2 CDN base URL for CLI binaries
_R2_BASE = "https://cdn.generaltranslation.com/cli"


def _cache_dir() -> str:
    """Return platform-appropriate cache directory."""
    if sys.platform == "darwin":
        base = os.path.join(os.path.expanduser("~"), "Library", "Caches")
    elif sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
    else:
        base = os.environ.get("XDG_CACHE_HOME", os.path.join(os.path.expanduser("~"), ".cache"))
    return os.path.join(base, "gtx-cli")


def _detect_binary_name() -> str:
    """Map current platform/arch to the binary filename."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    arch_map = {
        "x86_64": "x64",
        "amd64": "x64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }
    arch = arch_map.get(machine)
    if not arch:
        raise RuntimeError(f"Unsupported architecture: {machine}")

    if system == "darwin":
        return f"gt-darwin-{arch}"
    elif system == "linux":
        return f"gt-linux-{arch}"
    elif system == "windows":
        if arch != "x64":
            raise RuntimeError(f"Unsupported Windows architecture: {machine}")
        return "gt-win32-x64.exe"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")


def _download(url: str, dest: str) -> None:
    """Download a URL to a destination path with a temp-file swap."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(dest))
    try:
        with urllib.request.urlopen(url) as resp, os.fdopen(fd, "wb") as out:
            while True:
                chunk = resp.read(1 << 16)
                if not chunk:
                    break
                out.write(chunk)
        os.replace(tmp, dest)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _ensure_binary(version: str) -> str:
    """Return path to the gt binary, downloading if necessary."""
    binary_name = _detect_binary_name()
    cache = _cache_dir()
    binary_path = os.path.join(cache, version, binary_name)

    if not os.path.isfile(binary_path):
        url = f"{_R2_BASE}/v{version}/{binary_name}"
        print(f"Downloading gt CLI v{version}...", file=sys.stderr)
        _download(url, binary_path)

        # Make executable on Unix
        if not binary_name.endswith(".exe"):
            st = os.stat(binary_path)
            os.chmod(binary_path, st.st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

    return binary_path


def main() -> None:
    """Entry point: download (if needed) and exec the gt binary."""
    from gtx_cli import __version__ as version

    try:
        binary = _ensure_binary(version)
    except Exception as exc:
        print(f"gtx-cli: failed to get binary: {exc}", file=sys.stderr)
        sys.exit(1)

    # On Unix, exec replaces the process; on Windows, use subprocess
    if sys.platform == "win32":
        result = subprocess.run([binary, *sys.argv[1:]])
        sys.exit(result.returncode)
    else:
        os.execv(binary, [binary, *sys.argv[1:]])

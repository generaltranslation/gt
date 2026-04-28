#!/usr/bin/env python3
"""Build platform-specific PyPI wheels that each bundle one gt executable."""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PlatformWheel:
    name: str
    source_binary: str
    bundled_binary: str
    wheel_tag: str


PLATFORM_WHEELS = (
    # Keep macOS wheel tags aligned with the bundled Bun executables' minos.
    # Current outputs report minos 13.0 via `otool -l`.
    PlatformWheel("macos-arm64", "gt-darwin-arm64", "gt", "py3-none-macosx_13_0_arm64"),
    PlatformWheel("macos-x64", "gt-darwin-x64", "gt", "py3-none-macosx_13_0_x86_64"),
    PlatformWheel("linux-arm64", "gt-linux-arm64", "gt", "py3-none-manylinux_2_17_aarch64"),
    PlatformWheel("linux-x64", "gt-linux-x64", "gt", "py3-none-manylinux_2_17_x86_64"),
    PlatformWheel("windows-x64", "gt-win32-x64.exe", "gt.exe", "py3-none-win_amd64"),
)

PYPI_DIR = Path(__file__).resolve().parents[1]
BIN_DIR = PYPI_DIR / "gtx_cli" / "bin"
INIT_PATH = PYPI_DIR / "gtx_cli" / "__init__.py"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True, help="Version to embed in the wheel metadata")
    parser.add_argument(
        "--source",
        type=Path,
        default=PYPI_DIR.parent / "binaries",
        help="Directory containing binaries from packages/cli/scripts/build-exe.sh",
    )
    parser.add_argument("--out-dir", type=Path, default=PYPI_DIR / "dist")
    parser.add_argument(
        "--platform",
        action="append",
        choices=[platform.name for platform in PLATFORM_WHEELS],
        help="Platform to build. May be passed more than once. Defaults to all platforms.",
    )
    parser.add_argument("--check", action="store_true", help="Run twine check on the built wheels")
    parser.add_argument("--upload", action="store_true", help="Upload the built wheels with twine")
    parser.add_argument("--skip-existing", action="store_true", help="Pass --skip-existing to twine upload")
    parser.add_argument(
        "--token-file",
        type=Path,
        help="File containing a PyPI API token. Used only when --upload is passed.",
    )
    return parser.parse_args()


def set_version(version: str) -> str:
    original = INIT_PATH.read_text(encoding="utf-8")
    updated = original
    marker = '__version__ = "'
    start = updated.find(marker)
    if start == -1:
        raise SystemExit(f"Could not find __version__ assignment in {INIT_PATH}")
    start += len(marker)
    end = updated.find('"', start)
    if end == -1:
        raise SystemExit(f"Could not parse __version__ assignment in {INIT_PATH}")
    updated = updated[:start] + version + updated[end:]
    INIT_PATH.write_text(updated, encoding="utf-8")
    return original


def clean_bin_dir() -> None:
    if BIN_DIR.exists():
        shutil.rmtree(BIN_DIR)
    BIN_DIR.mkdir(parents=True)


def prepare_binary(source: Path, platform_wheel: PlatformWheel) -> None:
    clean_bin_dir()
    source_binary = source / platform_wheel.source_binary
    if not source_binary.is_file():
        raise SystemExit(f"Missing expected CLI binary: {source_binary}")

    target = BIN_DIR / platform_wheel.bundled_binary
    shutil.copy2(source_binary, target)
    if platform_wheel.bundled_binary != "gt.exe":
        target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def run_build(temp_out_dir: Path) -> Path:
    subprocess.run(
        [sys.executable, "-m", "build", "--wheel", "--outdir", str(temp_out_dir)],
        cwd=PYPI_DIR,
        check=True,
    )
    wheels = list(temp_out_dir.glob("*.whl"))
    if len(wheels) != 1:
        raise SystemExit(f"Expected exactly one wheel in {temp_out_dir}, found {len(wheels)}")
    return wheels[0]


def wheel_record_hash(data: bytes) -> str:
    digest = hashlib.sha256(data).digest()
    encoded = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return f"sha256={encoded}"


def rewrite_wheel_metadata(metadata: bytes, wheel_tag: str) -> bytes:
    text = metadata.decode("utf-8")
    lines = []
    saw_tag = False
    for line in text.splitlines():
        if line.startswith("Root-Is-Purelib:"):
            lines.append("Root-Is-Purelib: false")
        elif line.startswith("Tag:"):
            if not saw_tag:
                lines.append(f"Tag: {wheel_tag}")
                saw_tag = True
        else:
            lines.append(line)

    if not saw_tag:
        lines.append(f"Tag: {wheel_tag}")

    return ("\n".join(lines) + "\n").encode("utf-8")


def retag_wheel(source_wheel: Path, output_dir: Path, wheel_tag: str) -> Path:
    wheel_name = source_wheel.name
    name_parts = wheel_name[:-4].rsplit("-", 3)
    if len(name_parts) != 4:
        raise SystemExit(f"Unexpected wheel filename: {wheel_name}")

    output_wheel = output_dir / f"{name_parts[0]}-{wheel_tag}.whl"
    records: dict[str, bytes] = {}
    record_path = ""

    with zipfile.ZipFile(source_wheel, "r") as src, zipfile.ZipFile(output_wheel, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            data = src.read(info.filename)
            if info.filename.endswith(".dist-info/RECORD"):
                record_path = info.filename
                continue
            if info.filename.endswith(".dist-info/WHEEL"):
                data = rewrite_wheel_metadata(data, wheel_tag)

            dst.writestr(info, data)
            records[info.filename] = data

        if not record_path:
            output_wheel.unlink(missing_ok=True)
            raise SystemExit(f"Could not find RECORD in {source_wheel}")

        record_buffer = io.StringIO()
        writer = csv.writer(record_buffer, lineterminator="\n")
        for filename, data in records.items():
            writer.writerow([filename, wheel_record_hash(data), str(len(data))])
        writer.writerow([record_path, "", ""])
        dst.writestr(record_path, record_buffer.getvalue().encode("utf-8"))

    return output_wheel


def selected_platforms(names: list[str] | None) -> list[PlatformWheel]:
    if not names:
        return list(PLATFORM_WHEELS)
    requested = set(names)
    return [platform for platform in PLATFORM_WHEELS if platform.name in requested]


def run_twine(args: argparse.Namespace, wheels: list[Path]) -> None:
    if not wheels:
        return

    if args.check:
        subprocess.run([sys.executable, "-m", "twine", "check", *(str(wheel) for wheel in wheels)], check=True)

    if args.upload:
        env = os.environ.copy()
        if args.token_file:
            env["TWINE_USERNAME"] = "__token__"
            env["TWINE_PASSWORD"] = args.token_file.expanduser().read_text(encoding="utf-8").strip()

        command = [sys.executable, "-m", "twine", "upload"]
        if args.skip_existing:
            command.append("--skip-existing")
        command.extend(str(wheel) for wheel in wheels)
        subprocess.run(command, check=True, env=env)


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    output_dir = args.out_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    original_init: str | None = None
    built_wheels: list[Path] = []
    try:
        original_init = set_version(args.version)
        for platform_wheel in selected_platforms(args.platform):
            print(f"Building {platform_wheel.name} wheel...", flush=True)
            prepare_binary(source, platform_wheel)
            with tempfile.TemporaryDirectory(prefix=f"gtx-cli-{platform_wheel.name}-") as temp_dir:
                pure_wheel = run_build(Path(temp_dir))
                built_wheels.append(retag_wheel(pure_wheel, output_dir, platform_wheel.wheel_tag))
    finally:
        if original_init is not None:
            INIT_PATH.write_text(original_init, encoding="utf-8")
        clean_bin_dir()

    for wheel in built_wheels:
        print(wheel)
    run_twine(args, built_wheels)


if __name__ == "__main__":
    main()

"""Python launcher for the General Translation CLI."""

__version__ = "0.0.0"


def main() -> None:
    """Run the General Translation CLI."""
    from gtx_cli.cli import main as _main

    _main()

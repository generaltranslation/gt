"""gtx-cli: CLI tool for AI-powered i18n — General Translation."""

__version__ = "0.0.0"  # Replaced at publish time by the workflow


def main() -> None:
    """Entry point."""
    from gtx_cli.cli import main as _main

    _main()

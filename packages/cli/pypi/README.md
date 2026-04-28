# gtx-cli

CLI tool for AI-powered i18n — [General Translation](https://generaltranslation.com).

This is a Python wrapper that downloads and runs the `gt` CLI binary. It provides the same functionality as `npx gt` but installable via `pip`.

## Installation

```bash
pip install gtx-cli
```

## Usage

```bash
# Initialize your project
gt init

# Translate your project
gt translate

# Upload translation keys
gt upload
```

Both `gt` and `gtx` commands are available after installation.

## Documentation

Visit [generaltranslation.com/docs/cli](https://generaltranslation.com/docs/cli) for full documentation.

## How It Works

On first run, the CLI binary is downloaded for your platform (macOS, Linux, or Windows) and cached locally. Subsequent runs use the cached binary directly.

## License

FSL-1.1-ALv2 — see [LICENSE](https://github.com/generaltranslation/gt/blob/main/packages/cli/LICENSE.md).

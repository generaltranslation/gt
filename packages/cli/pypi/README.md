# gtx-cli

`gtx-cli` is the PyPI distribution for the General Translation CLI. It installs
a `gt` command that runs the bundled standalone binary for your platform.

## Installation

```bash
pip install gtx-cli
```

## Usage

```bash
gt init
gt translate
gt upload
```

## How it works

PyPI hosts one wheel per supported platform. Each wheel contains the
Bun-compiled CLI binary for that platform. At runtime, the Python launcher execs
the bundled binary directly.

## Documentation

Full CLI documentation is available at
[generaltranslation.com/docs/cli](https://generaltranslation.com/docs/cli).

## Release

Build the Bun executables first from `packages/cli`, then build and publish the
platform wheels:

```bash
pnpm --filter gt run build:bin:clean
cd packages/cli/pypi
python -m pip install --upgrade build twine
python scripts/build_platform_wheels.py \
  --version 2.14.22 \
  --source ../binaries \
  --check \
  --upload \
  --skip-existing \
  --token-file ~/Documents/dev/secrets/pypi-api-token.txt
```

The script restores `gtx_cli.__version__` and removes copied binaries from the
source tree after building.

## License

FSL-1.1-ALv2. See `LICENSE.md`.

---
'gt': patch
---

The argument parser now rejects credential flag pairs (`--[no-]dev-credentials` with `--[no-]live-translations`) before setup runs, including matching pairs like `--dev-credentials --live-translations`. Unknown `gt git merge-driver` names and invalid `--timeout` values now get the standard argument error and exit code 1 instead of a custom error or an uncaught exception.

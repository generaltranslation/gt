---
'gt': patch
---

`gt init` now detects the package manager when run inside a workspace member (for example `apps/web` in a pnpm, npm, yarn or bun workspace) by reading the workspace root's `packageManager` field or lockfile, instead of asking you to pick one. A parent directory is only used when its workspace patterns include the project, so a standalone app inside another project still asks.

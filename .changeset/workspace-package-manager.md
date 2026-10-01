---
'gt': patch
---

`gt init` now detects the package manager when run inside a workspace member (for example `apps/web` in a pnpm, npm, yarn or bun workspace) by reading the nearest lockfile, `packageManager` or `devEngines` field up to the git root, instead of asking you to pick one. Detection now uses `package-manager-detector`.

---
'gt': patch
---

`gt init` no longer stops when pnpm 11 installs a package but reports ignored dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`). Setup continues and warns which packages to add under `allowBuilds` in `pnpm-workspace.yaml` (or to approve with `pnpm approve-builds`).

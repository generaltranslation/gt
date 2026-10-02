---
'gt': patch
---

`gt` now bundles dictionary files with `esbuild-wasm` instead of native `esbuild`, so installing `gt` runs no dependency build scripts. With pnpm 11's default `strictDepBuilds`, installing `gt` and running `gt init` no longer fail because esbuild's build script was not approved.

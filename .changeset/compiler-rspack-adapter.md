---
'@generaltranslation/compiler': patch
---

Export an `rspack` plugin adapter alongside the existing `webpack`, `vite`, `rollup`, and `esbuild` adapters. This lets Rspack based toolchains (such as Rsbuild) wire the GT compiler in through `tools.rspack.plugins`. The adapter is the `rspack` output of the shared unplugin instance, so it behaves identically to the other bundler adapters.

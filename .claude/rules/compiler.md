---
paths:
  - 'packages/compiler/**'
  - 'packages/next/src/plugin/**'
---

# Compiler & Build Plugin Rules

- `@generaltranslation/compiler` is an `unplugin`-based build plugin supporting webpack, Vite, Rollup, and esbuild.
- It uses Babel for AST transformations at compile time.
- `gt-next` includes an SWC plugin (Rust-based) in addition to the JS compiler plugin.
- `packages/compiler/src/index.ts` is the package entrypoint. Put compiler implementation, config, and types under `src` subdirectories; do not add top-level `src/*.ts` logic files unless they are package entrypoints.
- Test compiler changes against the test apps in `tests/apps/` and examples in `examples/`.

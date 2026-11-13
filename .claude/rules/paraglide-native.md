---
paths:
  - 'packages/paraglide-js/native/**'
---

# Paraglide Analysis (Rust) Rules

- `packages/paraglide-js/native` is a Rust crate, built as a Node addon with napi-rs. Building it needs a Rust toolchain (https://rustup.rs).
- Build: `pnpm --filter @generaltranslation/paraglide-js build:native`. Test: `pnpm --filter @generaltranslation/paraglide-js test:rust`, then the package's Vitest tests, which run against the built addon.
- Format with `cargo fmt` (the crate's `rustfmt.toml`); `cargo clippy --release --all-targets` must have no warnings.
- After changing what JavaScript calls in `binding.rs`, regenerate `binding.cjs` and `binding.d.cts` with `build:native:bindings`.
- The crate exists for speed: time a change with the `bench` example (`native/README.md`) before and after it.

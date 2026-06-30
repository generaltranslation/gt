---
"gt-i18n": patch
---

Build `gt-i18n` with unbundled, tree-shakeable implementation modules.

The package now keeps the existing public entrypoints (`.`, `types`, `fallbacks`, `internal`, and `internal/types`) while emitting their internal implementation graph as separate CJS and ESM files, matching the package shape used by `@generaltranslation/react-core`. The package export paths and declaration filenames are unchanged, but downstream bundlers can now analyze the smaller module graph instead of treating each entrypoint as one bundled file.

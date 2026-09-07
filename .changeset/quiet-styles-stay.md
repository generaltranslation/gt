---
'@generaltranslation/compiler': patch
'gt': patch
---

Align CLI automatic JSX insertion with compiler expression handling, component ownership, lexical bindings, and React runtime calls while preserving the original TypeScript source.

Preserve leading JSX runtime pragmas and static enum values. Match extracted translation hashes for explicit child arrays, whitespace, branching props, and cross-file derivations.

Respect per-file TypeScript and JavaScript JSX import-source settings, inherited configuration, explicit `--tsconfig`/`--jsconfig` selection, and source pragma overrides during CLI automatic insertion.

Fix compiler-generated React helper bindings for child arrays and mixed runtime imports. Run automatic JSX insertion when it is the only enabled compiler transformation, and retain the result when unrelated build validation is disabled.

Keep automatically wrapped dynamic arrays available for runtime hashing under default build checks while preserving validation and compile-time hashes for manual translation components.

Respect verified GT runtime package boundaries supplied by framework integrations during automatic insertion, while keeping other compiler transformations enabled.

Preserve the compiler's existing raw-loader transformations and parse diagnostics when automatic insertion is disabled. Keep CLI parsing options intact in this mode, and preserve lazy or inherited package-resolution settings in both modes.

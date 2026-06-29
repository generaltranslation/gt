---
"@generaltranslation/react-core": patch
---

Build `@generaltranslation/react-core` as unbundled, tree-shakeable modules.

Each entrypoint (`pure`, `hooks`, `components`, `components-rsc`, `cookies`) was previously emitted as a single pre-bundled, minified file, so a consumer importing one component pulled the entire entry. The package now builds unbundled (per-module) output in both ESM and CJS: entrypoints are thin re-export barrels over granular sibling modules, allowing a downstream bundler to drop unused components and hooks.

The build also stops inlining `generaltranslation`/`@generaltranslation/format` into react-core's output, so they resolve to their single shared copy instead of being duplicated in react-core (they are already loaded standalone). This removes the duplication and keeps the per-module declarations referencing the dependency packages directly, so inferred types stay portable for downstream packages.

When consumed via ESM (see the companion `gt-next` ESM change), tree-shaking plus de-duplication cuts react-core's client footprint substantially. Output filenames change from `*.cjs.min.cjs`/`*.esm.min.mjs` to `*.cjs`/`*.mjs` (resolved through the `exports` map, so no consumer-facing API change). The package-shape test is updated to assert the new unbundled layout.

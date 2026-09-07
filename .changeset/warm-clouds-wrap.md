---
'gt-next': minor
---

Support `enableAutoJsxInjection` in the Next.js SWC plugin, including Turbopack. Automatically wrap translatable JSX before hash injection, matching the wrapping behavior of `@generaltranslation/compiler`.

Read `files.gt.parsingFlags.enableAutoJsxInjection` from `gt.config.json` for both compiler integrations. Explicit `experimentalCompilerOptions.enableAutoJsxInjection` values take precedence.

Respect Next.js JSX import-source configuration, file-level runtime pragmas, and Emotion's distinct server and client runtimes when deciding whether to insert automatic wrappers.

Keep insertion enabled when compile-time hashing is disabled. Preserve precompiled React calls, development child-array behavior, and styled-jsx scope boundaries.

Preserve the SWC plugin binary in the published package by copying it after JavaScript transpilation cleans the output directory.

Keep verified GT runtime packages outside automatic JSX insertion, including linked and nested installations, while preserving manual translation hashing. Preserve internal loader module names across rebuilds so configured aliases and lazy loading remain intact.

Support the public configuration import from native ESM and `next.config.mjs`, including automatic JSX insertion, by preserving the configuration module's Node.js resolution context.

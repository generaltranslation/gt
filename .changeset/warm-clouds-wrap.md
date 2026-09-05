---
'gt-next': minor
---

Support `enableAutoJsxInjection` in the Next.js SWC plugin, including Turbopack. Automatically wrap translatable JSX before hash injection, matching the wrapping behavior of `@generaltranslation/compiler`.

Read `files.gt.parsingFlags.enableAutoJsxInjection` from `gt.config.json` for both compiler integrations. Explicit `experimentalCompilerOptions.enableAutoJsxInjection` values take precedence.

Respect Next.js JSX import-source configuration, file-level runtime pragmas, and Emotion's distinct server and client runtimes when deciding whether to insert automatic wrappers.

Preserve the SWC plugin binary in the published package by copying it after JavaScript transpilation cleans the output directory.

---
'gt-next': minor
---

Support `enableAutoJsxInjection` in the Next.js SWC plugin, including Turbopack. Automatically wrap translatable JSX before hash injection, matching the wrapping behavior of `@generaltranslation/compiler`.

Read `files.gt.parsingFlags.enableAutoJsxInjection` from `gt.config.json` for both compiler integrations. Explicit `experimentalCompilerOptions.enableAutoJsxInjection` values take precedence.

Preserve the SWC plugin binary in the published package by copying it after JavaScript transpilation cleans the output directory.

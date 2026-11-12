---
'gt': minor
---

`gt translate`, `gt stage`, `gt upload` and `gt setup` collect the source code context of Paraglide JS messages before reading the files to upload. Set `files.json.parsingFlags.includeSourceCodeContext` to `true` in `gt.config.json` in a project that has `@generaltranslation/paraglide-js` installed; running `paraglide-context` before the CLI is then no longer needed.

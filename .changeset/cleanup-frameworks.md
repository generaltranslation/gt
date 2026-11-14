---
'gt-next': patch
---

`withGTConfig()` props no longer declare `eslint`, `eslintSeverity` or `overwriteESLintConfig`, which had no effect: remove them from your `withGTConfig()` call. They also drop the `devApiKey?: never` placeholder; an inline `devApiKey` is still a type error and is ignored at runtime, and `apiKey` from `GT_API_KEY` replaces it.

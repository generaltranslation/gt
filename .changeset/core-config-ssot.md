---
'generaltranslation': patch
---

`generaltranslation/internal` exports `defaultDashboardUrl`, and `generaltranslation/config-schema` exports `gtConfigFilePaths` (the `gt.config.json` locations the CLI and gt-next search, in order) and `resolveAutoderive()`, so the CLI, the compiler and gt-next share one copy. The `vueCompilerOptions.whitespace` and `delimiters` options are now described in the `gt.config.json` schema. `GTConfig['customMapping']` is typed as `CustomMapping` again, so its objects name the locale properties.

---
'generaltranslation': patch
'@generaltranslation/compiler': patch
'gt-next': patch
---

Export `GTCompilerOptions` from `generaltranslation/types`, the compiler options that framework integrations pass to `@generaltranslation/compiler`. The compiler's `PluginConfig`, gt-next's `experimentalCompilerOptions` and gt-tanstack-start's `experimentalCompilerOptions` now share it instead of repeating its fields.

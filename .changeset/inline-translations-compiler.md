---
'@generaltranslation/compiler': minor
---

Embed translations at build time for the locales in gt.config.json's experimental `files.gt.inlineTranslations.locales`. In production builds the compiler reads each locale's translations from `files.gt.output` and embeds them at each `<T>` as the `inline` prop, and at each `gt` and `t` template from `/unstable` whose values are all named variables as the `inline` option, so bundlers tree-shake the translations with unused call sites. Stable `gt()` and `t()` and `msg()` are not embedded: load their strings from the file the CLI writes with `files.gt.inlineTranslations.msgOutput`. gt-next uses this with `experimentalCompilerOptions: { type: 'babel' }`.

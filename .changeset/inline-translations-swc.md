---
'gt-next': minor
---

Embed translations at build time with the SWC compiler (`experimentalCompilerOptions: { type: 'swc' }`) for the locales in gt.config.json's experimental `files.gt.inlineTranslations.locales`. In production builds the SWC plugin reads each locale's translations from `files.gt.output` and embeds them at each `<T>`, and at each `gt` and `t` template from `/unstable` whose values are all named variables. Stable `gt()` and `t()` and `msg()` are not embedded: load their strings from the file the CLI writes with `files.gt.inlineTranslations.msgOutput`.

With `files.gt.inlineTranslations.modules` set, gt-next writes one module per embedded message to `modulesDir` (default `.gt/messages`) and each call site imports it instead, so a message used at several call sites ships once. SWC plugins cannot serve virtual modules, so `'virtual'` falls back to physical modules with a warning. Add `modulesDir` to `.gitignore`.

---
'gt-next': minor
'generaltranslation': minor
---

Add experimental `files.gt.inlineTranslations.modules` and `modulesDir` options. With `modules: 'physical'`, SWC builds write one module per embedded message to `modulesDir` (default `.gt/messages`) and import it at each call site instead of embedding the translation there, so a message shared by several call sites ships once. SWC cannot serve virtual modules, so `'virtual'` falls back to physical modules with a warning. Add `modulesDir` to `.gitignore`.

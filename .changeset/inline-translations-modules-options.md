---
'generaltranslation': minor
---

Add the experimental `files.gt.inlineTranslations.modules` and `modulesDir` options to gt.config.json. Set `modules` to `'physical'` or `'virtual'` to import each embedded message from its own module instead of inlining its translations at every call site. Physical modules are written to `modulesDir` (default `.gt/messages`), which the build rewrites, so add it to `.gitignore`.

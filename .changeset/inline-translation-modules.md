---
'@generaltranslation/compiler': minor
---

Support the experimental `files.gt.inlineTranslations.modules` option in the compiler. Each embedded message becomes its own module, `export default (locale) => …`, which the call sites using that message import instead of inlining the translations callback, so call sites sharing a message share one module and bundlers include only the modules of messages in use. `'physical'` writes `<modulesDir>/<hash>.js` files at build start (`modulesDir` defaults to `.gt/messages`; add it to `.gitignore`), rewriting only changed files and deleting stale generated ones. `'virtual'` serves `virtual:gt/messages/<hash>.js` modules from memory in Vite, Rollup, Rolldown and esbuild, and falls back to physical modules with a warning in webpack and rspack.

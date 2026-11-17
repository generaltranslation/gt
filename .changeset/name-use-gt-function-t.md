---
'gt': patch
'gt-i18n': patch
'@generaltranslation/react-core-linter': patch
'@generaltranslation/vue-extractor': patch
---

The function returned by `useGT()` and `getGT()` is now named `t` throughout GT: `const t = useGT()`. Messages that named it `gt` say `t` instead: the `static-string` lint rule, the CLI's extraction warnings and the setup instructions it writes for AI agents, gt-i18n's tagged-template errors, and the Vue extractor's dynamic-content error. Nothing changes at runtime, and existing code that names it `gt` keeps working.

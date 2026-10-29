---
'@generaltranslation/react-core-linter': minor
---

Rules accept each configured library's `/compat` entry, such as `gt-tanstack-start/compat` and `gt-next/compat/server`, as the same library. `translation-function-placement` now checks `getTranslations()` from `gt-tanstack-start/compat`, and its hint names where to import the hook from, such as `useTranslations() from 'gt-tanstack-start/compat'`.

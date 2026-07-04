---
'@generaltranslation/react-core': patch
---

Remove the accidental `useShouldTranslate` export from `@generaltranslation/react-core/hooks`. The hook is an internal implementation detail and was never meant to be public.

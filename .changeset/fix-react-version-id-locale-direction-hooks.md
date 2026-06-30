---
"@generaltranslation/react-core": patch
"gt-react": patch
"gt-react-native": patch
---

Fix `useVersionId()` throwing and `useLocaleDirection()` requiring a locale argument in the client and server entrypoints.

`useVersionId()` now returns the current version id (instead of throwing the react-core "not implemented" error), and `useLocaleDirection()` once again accepts an optional locale that defaults to the current locale. The shared implementation now lives in `@generaltranslation/react-core/hooks`, so `gt-react` and `gt-react-native` use the same behavior; the RSC entrypoint keeps its stricter signatures.

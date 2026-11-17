---
'@generaltranslation/compiler': patch
---

The compiler no longer expands `` t`...` `` imported from `gt-tanstack-start`, since `gt-tanstack-start` no longer exports `t`, which is only available in client-rendered (SPA) apps. Other imports from `gt-tanstack-start` are handled as before.

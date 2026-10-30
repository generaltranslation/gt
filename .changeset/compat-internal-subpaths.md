---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
'gt-next': patch
'gt-tanstack-start': patch
'gt-node': patch
---

Move the dictionary (compat) internals to their own internal subpaths, `gt-i18n/internal/compat` and `@generaltranslation/react-core/compat`, so CommonJS builds of the native entries no longer load the dictionary runtime. `gt-i18n/internal` and `@generaltranslation/react-core/{pure,hooks,components}` no longer export it. No public API change.

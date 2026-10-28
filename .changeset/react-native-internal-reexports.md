---
'gt-react-native': patch
---

Re-export `gt-i18n` and `generaltranslation` functions from those packages instead of through `@generaltranslation/react-core/pure`, and export `initializeGT` from the entry instead of an internal pass-through module. No public API change.

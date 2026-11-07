---
'gt-react': patch
---

Re-export `gt-i18n` and `generaltranslation` functions from those packages instead of through `@generaltranslation/react-core/pure`, and read cookie names from `gt-i18n/internal/cookies`. gt-react now depends directly on `@generaltranslation/format`. No public API change.

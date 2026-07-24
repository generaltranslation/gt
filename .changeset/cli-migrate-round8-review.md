---
'gt': patch
'@generaltranslation/migrate': patch
---

gt migrate review hardening: preserve sibling declarators when splitting useTranslation destructures, hold files whose array destructure the rewrite cannot preserve (ready flag, defaults, rest elements), never merge named imports into a namespace import declaration, stop before writing when an existing gt.config.json cannot be parsed, and refuse to narrow the migrated locale set when supportedLngs lists locales with no local catalog.

---
'gt': patch
'@generaltranslation/migrate': patch
---

gt migrate review hardening: preserve sibling declarators when splitting useTranslation destructures, hold files whose destructure the rewrite cannot preserve (ready flag, defaults, rest elements, patterns binding nothing), never merge named imports into a namespace or type-only import declaration (in the config helper and in both source-file import surgeries; type-only bindings of needed symbols are promoted to value imports), stop before writing when an existing gt.config.json cannot be read as a JSON object, and refuse to narrow the migrated locale set when supportedLngs lists locales with no local catalog.

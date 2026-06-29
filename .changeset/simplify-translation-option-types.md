---
"@generaltranslation/react-core": major
"gt-i18n": major
"gt-next": major
"gt-node": major
"gt-react": major
"gt-react-native": major
---

Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

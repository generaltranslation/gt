---
'@generaltranslation/format': patch
'generaltranslation': patch
---

`CustomMapping` is read-only, and `LocaleConfig.customMapping` is a `CustomMapping`, so the frozen mapping a `GTIntl` keeps type-checks where a `CustomMapping` is expected.

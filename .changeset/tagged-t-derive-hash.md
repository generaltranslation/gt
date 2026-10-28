---
'@generaltranslation/react-core': patch
---

Fix tagged template `t` without the compiler. Translations for `derive()` content are now found: the interpolated message is looked up and formatted as ICU, matching the hash the CLI registers. In the default locale and with i18n disabled, `t` no longer renders `{0}` placeholders.

---
'@generaltranslation/compiler': minor
---

Expand string translation macros in call-argument form. Template-literal arguments (``t(`...`)``) and string concatenations (`t("a" + b)`) are now normalized the same way as ``t`...` `` tagged templates, honoring the existing `enableTemplateLiteralArg` and `enableConcatenationArg` settings.

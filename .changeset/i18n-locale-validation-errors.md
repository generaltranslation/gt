---
'gt-i18n': patch
---

`I18nConfig` reports invalid locales once, in the error it throws, instead of also logging each one with an `I18nConfig:` prefix. A `null` `customMapping` entry no longer crashes locale validation. `I18nConfig` no longer checks `localeMatcher` at runtime: the `LocaleMatcher` type and the `gt.config.json` validation in gt-next, the gt CLI, the compiler and gt-react-native cover it.

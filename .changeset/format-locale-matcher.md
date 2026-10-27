---
'@generaltranslation/format': major
'generaltranslation': minor
'gt-i18n': major
'gt-next': major
'gt-vue': minor
---

`determineLocale` now follows standard locale matching, selected by a new `localeMatcher` option (`'lookup' | 'best fit'`, default `'best fit'`) on `LocaleConfig`, `GTConfig`, gt-i18n's `I18nConfig` params, and gt-next's `withGTConfig` / `gt.config.json`. The `LocaleMatcher` type is exported next to `LocaleConfig`, and `I18nConfig` throws for any other value.

Requested and configured locales are canonicalized the same way (`customMapping` alias → code, invalid tags skipped, standardized; a requested tag only needs a valid language-script-region base, so extension and private-use subtags are allowed), and the result is always the configured spelling. `determineLocale` never applies `defaultLocale`; callers keep owning the fallback.

- `'lookup'` (RFC 4647 §3.4 Lookup): for each requested locale in priority order, truncate it from the end (a single-letter subtag is removed with the subtag after it, so `zh-Hant-CN-x-private1-private2` → `zh-Hant-CN-x-private1` → `zh-Hant-CN` → `zh-Hant` → `zh`) and return the first configured locale equal to a truncation; `*` is skipped.
- `'best fit'`: take the requested languages in order of first appearance. For each language, run Lookup over the requested locales of that language against the configured locales of that language; if nothing matches, return the first configured locale of that language (configured order) whose likely script (`Intl.Locale.prototype.maximize`) equals the script of a requested locale of that language, trying requested locales in order. Then move to the next language. A region difference is acceptable; a script difference is not (no `sr-Latn` ↔ `sr-Cyrl` exception). Tags without a derivable script, such as `qaa`, compare as an empty script.

The standalone `determineLocale(locales, approvedLocales, customMapping)` now delegates to `new GTIntl({ locales: approvedLocales, customMapping }).determineLocale(locales)`, so it resolves aliases and returns the configured spelling. It always uses `'best fit'`. gt-vue's `initializeGTSPA()` accepts `localeMatcher` too, so a `gt.config.json` object passed to it keeps its matcher.

Behavior changes (before → after, default `'best fit'`):

| Requested → configured                      | Before      | After       |
| ------------------------------------------- | ----------- | ----------- |
| ------------------------------------------- | ----------- | ----------- |
| `en` → `en-GB, fr-FR`                       | `undefined` | `en-GB`     |
| `['en', 'fr']` → `en-GB, fr-FR`             | `fr-FR`     | `en-GB`     |
| `en-AU` → `en-GB`                           | `undefined` | `en-GB`     |
| `['en-AU', 'en-GB']` → `en-US, en-GB`       | `en-US`     | `en-GB`     |
| `zh-TW` → `zh-CN, en`                       | `zh-CN`     | `undefined` |
| `sr-Latn` → `sr-Cyrl`                       | `sr-Cyrl`   | `undefined` |
| `en` → `en-GB, en-US`                       | `en-US`     | `en-GB`     |
| standalone, `brand-fr` aliased and approved | `brand-FR`  | `brand-fr`  |

---
'@generaltranslation/react-core': major
---

`@generaltranslation/react-core/pure` no longer re-exports names that `gt-i18n`, `generaltranslation`, or `@generaltranslation/format` own. Import them from their owner:

- `msg`, `mFallback`, `getDefaultLocale`, `getLocaleProperties`, `getLocales`, `resolveCanonicalLocale`, `getVersionId`: import from `gt-i18n`, which also exports the other message helpers (`derive`, `plural`, `select`, `selectordinal`, `part`, `number`, `n`, `date`) and their types.
- `declareVar`, `decodeVars` and the `derive` that marks a string: import from `generaltranslation`.
- `decodeMsg`, `decodeOptions`, `gtFallback` and the types `GTTranslationOptions`, `GTFunctionType`, `MFunctionType`, `RuntimeTranslationOptions`: removed with the string functions (see the tagged-template API changeset).
- `ReadonlyConditionStore`: import from `gt-i18n/internal`.
- `defaultLocaleCookieName`, `defaultRegionCookieName`, `defaultEnableI18nCookieName`, `defaultResetLocaleCookieName`: import from `gt-i18n/internal/cookies`.
- Type `GTProp`: import from `@generaltranslation/format`.

`gt-react`, `gt-react-native`, `gt-next`, and `gt-tanstack-start` still export the user-facing names that remain.

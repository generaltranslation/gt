---
'@generaltranslation/react-core': major
---

`@generaltranslation/react-core/pure` no longer re-exports names that `gt-i18n`, `generaltranslation`, or `@generaltranslation/format` own. Import them from their owner:

- `msg`, `decodeMsg`, `decodeOptions`, `mFallback`, `gtFallback`, `getDefaultLocale`, `getLocaleProperties`, `getLocales`, `resolveCanonicalLocale`, `getVersionId`: import from `gt-i18n`.
- `derive`, `declareVar`, `decodeVars`: import from `generaltranslation` (or `gt-i18n`).
- `ReadonlyConditionStore`: import from `gt-i18n/internal`.
- `defaultLocaleCookieName`, `defaultRegionCookieName`, `defaultEnableI18nCookieName`, `defaultResetLocaleCookieName`: import from `gt-i18n/internal/cookies`.
- Types `GTTranslationOptions`, `GTFunctionType`, `MFunctionType`, `RuntimeTranslationOptions`: import from `gt-i18n/types`.
- Type `GTProp`: import from `@generaltranslation/format/types`.

`gt-react`, `gt-react-native`, `gt-next`, and `gt-tanstack-start` still export the same user-facing names.

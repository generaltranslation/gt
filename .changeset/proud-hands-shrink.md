---
'@generaltranslation/react-core': patch
---

Move the default cookie-name constants (`defaultLocaleCookieName`, `defaultRegionCookieName`, `defaultEnableI18nCookieName`, `defaultResetLocaleCookieName`) into a dependency-free module. They were co-located with `ReactI18nConfig`, so importing just a cookie name from `@generaltranslation/react-core/pure` could drag the `gt-i18n/internal` runtime (~60KB) into size-constrained bundles like gt-next's edge middleware. The `/pure` entry re-exports them unchanged.

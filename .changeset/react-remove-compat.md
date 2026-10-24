---
'@generaltranslation/react-core': major
'gt-next': major
'gt-react': major
'gt-react-native': major
'gt-tanstack-start': major
---

Remove the remaining backward compatibility:

- `<T>` no longer reads `$context`, `$id`, `$maxChars`, `$requiresReview`, `$format`, or `$_hash`; use `context`, `id`, `maxChars`, `requiresReview`.
- `<LocaleSelector>` drops `customNames`; use `customMapping={{ [locale]: { name } }}`.
- gt-next: `parseLocale()` no longer detects the locale from request headers, cookies, or `Accept-Language` when Next.js provides none; it uses Next.js `defaultLocale` (or the GT default) and warns, like `withGTStaticProps`. Configure Next.js `i18n`.
- gt-next: `experimentalCompilerOptions.compileTimeHash: false` no longer switches the compiler off; use `experimentalCompilerOptions.type: 'none'`.
- gt-next: runtime translation requests no longer send `projectId`, `timeout`, `publish`, `fast`, or `sourceLocale` in request `metadata`.
- gt-react-native: locale detection drops the fallbacks for unsupported runtimes (Android < 24 and Internet Explorer's `navigator.userLanguage`).

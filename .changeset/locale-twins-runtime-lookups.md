---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-tanstack-start': minor
---

feat: resolve translations from locale twins at runtime

- With `files.gt.splitting: 'locale-twins'` in the config passed to `initializeGT*`/`initializeGTSPA`, a browser production client reads translations from the registered locale twins only. It never loads whole locales or calls the CDN (even with `projectId`/`VITE_GT_PROJECT_ID` or `loadTranslations`), `initializeGTSPA` resolves without loading, and `getTranslationsSnapshot` loads nothing. Servers (TanStack Start SSR) and `vite dev` keep loading whole locales. The dictionaries API stays on whole-locale loading: a client initialized with a `dictionary` (or `loadDictionary`) keeps its translation loader, and only dictionary lookups read it; without one, dictionary entries render untranslated and a warning is logged once.
- Lookups that carry a compiler-injected hash (`<T>`, `useGT`, `useMessages`/`m()`, `t()`, `getGT`, `getMessages`) resolve from the registered twins before any source-locale short-circuit, so stripped source text renders from the source-locale twin. A translation missing from a twin (its source text, listed in the table's `s`) is formatted in the source locale, as a missing translation is without locale twins. In production builds, content without a compile-time hash renders its source text, on the server and in the browser alike, in React lookups and in `getGT()`/`getMessages()` (dictionaries excepted). With i18n disabled (`enableI18n: false`), lookups read and format the default locale's twins.
- `gt-i18n` logs a diagnostic once per page when twin mode is on but no twin was registered (a short error naming the compiler plugin when nothing registered, or a detailed one when only untwinned chunks were served), when twins were registered but twin mode is off, or when the twins' locale differs from the rendered locale.
- This runtime behaviour loads with the first registration call (every module the compiler builds with locale twins makes one, with or without entries), so apps without locale twins do not ship it; they keep only small checks (about 0.5 kB gzip).
- In twin mode, `setLocale`/`useSetLocale` (and region / enableI18n switches) always load a new document: a custom `_reload` still runs but is followed by a document reload, unless it is marked as a navigation with `markNavigatingReload`, exported from `gt-react` and `gt-tanstack-start` (web-only, not from `gt-react-native`). gt-tanstack-start marks its `localeRouting` reload.
- `<T>` now renders translated content into an element whose source child is an empty string, and applies translated `placeholder`/`title`/`alt`/`aria-*` props to childless elements (such as `<input>`).
- `gt-react-native` is unaffected: it never registers twins, so its lookups behave as before.

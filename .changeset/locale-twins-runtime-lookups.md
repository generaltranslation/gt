---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-tanstack-start': minor
---

feat: render locale twin content at runtime

- Call sites of a locale twin carry their content inline: the compiler's `$_twin` option (`gt()`, `t()`, `msg()`) or `_twin` prop (`<T>`) is `[locale, content]` in each twin. `<T>`, `useGT`, `useMessages`/`m()`, `t()`, `getGT`, `getMessages` and `msg()`/`decodeMsg()` render that content, formatted with that locale's rules, before any source-locale short-circuit, so stripped source text renders from the source-locale twin. A translation missing from a twin is the source text with the source locale, formatted like a missing translation without locale twins. `<T>` combines the twin's JSX with the stripped source children by element index. Content marked `0` renders its source text in the source locale. With i18n disabled (`enableI18n: false`), the page has the default locale's twins.
- With `files.gt.splitting: 'locale-twins'` in the config passed to `initializeGT*`/`initializeGTSPA`, a browser production client never loads whole locales or calls the CDN (even with `projectId`/`VITE_GT_PROJECT_ID` or `loadTranslations`), `initializeGTSPA` resolves without loading, and `getTranslationsSnapshot` loads nothing. Servers (TanStack Start SSR) and `vite dev` keep loading whole locales. The dictionaries API stays on whole-locale loading: a client initialized with a `dictionary` (or `loadDictionary`) keeps its translation loader, and only dictionary lookups read it.
- `gt-i18n` logs one short error per page when such a client renders content without a locale twin marker (the compiler plugin is missing, or the original chunks were served instead of their twins).
- Apps without locale twins pay about 0.4 kB gzip for these checks.
- In twin mode, `setLocale`/`useSetLocale` (and region / enableI18n switches) always load a new document: a custom `_reload` still runs but is followed by a document reload, unless it is marked as a navigation with `markNavigatingReload`, exported from `gt-react` and `gt-tanstack-start` (web-only, not from `gt-react-native`). gt-tanstack-start marks its `localeRouting` reload.
- `<T>` now renders translated content into an element whose source child is an empty string, and applies translated `placeholder`/`title`/`alt`/`aria-*` props to childless elements (such as `<input>`).
- `gt-react-native` is unaffected: its builds carry no locale twin markers, so its lookups behave as before.

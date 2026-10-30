---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-tanstack-start': minor
---

feat: resolve translations from locale twins at runtime (experimental)

Locale twins are experimental and live behind `/experimental` entry points. Apps that use them import every GT API from `gt-react/experimental` (or `gt-tanstack-start/experimental`); the regular entry points have no locale twin code, so other apps' bundles are unchanged.

- `gt-react/experimental` re-exports `gt-react` and replaces what locale twins change: `<T>`, `useGT`, `useMessages`, `t`, `msg`, `GTProvider` (`translations` is optional), `initializeGT`, `initializeGTSPA` and `createOrUpdateBrowserConditionStore`. It adds `GtInternalRegisterLocaleTwin` and `markNavigatingReload`. Under `react-server` it adds only the exports that need no hooks to the RSC entry. The React pieces are in `@generaltranslation/react-core/internal/experimental`, the shared runtime in `gt-i18n/internal/experimental` (including locale twin `getGTInternal()`/`getMessagesInternal()`).
- With `experimental.splitting: 'locale-twins'` in the config passed to `initializeGT`/`initializeGTSPA`, a browser production client reads translations from the registered locale twins only. It never loads whole locales or calls the CDN (even with `projectId`/`VITE_GT_PROJECT_ID` or `loadTranslations`), and `initializeGTSPA` resolves without loading. Servers (TanStack Start SSR) and `vite dev` keep loading whole locales. The dictionaries API stays on whole-locale loading: a client initialized with a `dictionary` (or `loadDictionary`) keeps its translation loader.
- Lookups that carry a compiler-injected hash (`<T>`, `useGT`, `useMessages`/`m()`, `t()`, `getGT`, `getMessages`) resolve from the registered twins before any source-locale short-circuit, so stripped source text renders from the source-locale twin. A translation missing from a twin (its source text, listed in the table's `s`) is formatted in the source locale. In production builds, content without a compile-time hash renders its source text, on the server and in the browser alike. With i18n disabled (`enableI18n: false`), lookups read the default locale's twins. `<T>` renders translated content into source children the build stripped, including translated `placeholder`/`title`/`alt`/`aria-*` props of childless elements.
- A `msg()` whose variables `m()` supplies (`m(msg('Welcome, {user}!'), { user })`) keeps the compiler-injected hash when it cannot be formatted yet, so `m()`/`useMessages()`/`getMessages()` translate it on the server and on a locale twin client alike. Variables given to `m()` fill in those the encoded message does not have.
- `gt-i18n` logs a diagnostic once per page when twin mode is on but no compiled module ran (a missing compiler plugin), when only untwinned chunks were served, when twins were registered but twin mode is off, or when the twins' locale differs from the rendered locale.
- In twin mode, `setLocale`/`useSetLocale` (and region / enableI18n switches) always load a new document: a custom `_reload` still runs but is followed by a document reload, unless it is marked as a navigation with `markNavigatingReload`. `gt-tanstack-start/experimental` marks its `localeRouting` reload.

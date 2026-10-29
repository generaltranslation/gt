---
"@generaltranslation/react-core": minor
"gt-react": minor
"gt-react-native": minor
"gt-next": minor
"gt-tanstack-start": minor
"gt-node": minor
---

Add experimental opt-in `/unstable` entries for tagged-template message trees from `gt-i18n/unstable`. Each entry exports the `t` tag (except `gt-next` and `gt-react-native`, whose root entries also omit `t`), the `plural`, `selectordinal`, `select`, `number`, `date`, `part`, and `derive` helpers, `n` for the plural count, and the `GT`, `GTOptions`, `Placeholder`, and `Fragment` types. Root entries are unchanged.

- `@generaltranslation/react-core/unstable`: `useGT()` returns a GT bound to the render locale. Under a `<GTProvider>` it reads only the provider's translations for the render locale, so server and client render the same output, and it re-renders when they change. Without a provider it reads the translation cache. A `locale` override translates even on a default-locale page when the provider's translations include that locale. Under a provider that hydrates (every web provider), an override missing from them renders the source on both server and client, because a server and a browser can load different catalogs; include that locale in the provider's translations to translate it. Without a provider, and under `gt-react-native`'s provider, which never hydrates, the component instead suspends until the locale loads into the translation cache. A failed load is thrown to the nearest error boundary, or renders the source when the cache already handled the failure, and is retried after a few seconds. Overrides to a locale that needs no translation, and every message while i18n is disabled, render the source without suspending. The gt-react provider props gain an optional internal `_canLoadOverrideLocales` prop, which only `gt-react-native` sets. `t` follows the legacy react-core `t` rules: module-level calls are rejected in server-rendered apps, and messages render untranslated when i18n is disabled or the requested locale needs no translation. `@generaltranslation/react-core/unstable-rsc` exports the same surface without hooks.
- `gt-react/unstable` and `gt-react-native/unstable`: the react-core client surface, without `t` in React Native. `gt-react/unstable` resolves to an RSC variant under `react-server`, where `useGT()` waits for the request locale's translations.
- `gt-next/unstable` resolves under the same conditions as `gt-next` and exports `useGT()` instead of `t`. `gt-next/unstable/server` exports an async `getGT()` for the request locale.
- `gt-tanstack-start/unstable` adds an async `getGT()` bound to the request on the server and to the browser locale in the browser.
- `gt-node/unstable`: `t` and an async `getGT()` for the current `withGT()` locale.

---
"@generaltranslation/react-core": minor
"gt-react": minor
"gt-react-native": minor
"gt-next": minor
"gt-tanstack-start": minor
"gt-node": minor
---

Add experimental opt-in `/unstable` entries for tagged-template message trees from `gt-i18n/unstable`. Each entry exports the `t` tag (except `gt-next`, `gt-react-native` and `gt-node`, whose root entries also omit `t`), the `plural`, `selectordinal`, `select`, `number`, `date`, `part`, and `derive` helpers, `n` for the plural count, and the `GT`, `GTOptions`, `Placeholder`, and `Fragment` types. Root entries are unchanged. `/unstable` entries may change in any minor release and are not covered by semver.

- `@generaltranslation/react-core/unstable`: `useGT()` returns a GT bound to the render locale. It reads translations like the legacy `useGT()`: the provider's translations, then the translation cache, and in dev hot reload it sends misses for runtime translation and re-renders when they arrive. `t` follows the legacy react-core `t` rules: module-level calls are rejected in server-rendered apps, and messages render untranslated when i18n is disabled or the requested locale needs no translation. `@generaltranslation/react-core/unstable-rsc` exports the same surface without hooks.
- `gt-react/unstable` and `gt-react-native/unstable`: the react-core client surface, without `t` in React Native. `gt-react/unstable` resolves to an RSC variant under `react-server`, where `useGT()` waits for the request locale's translations.
- `gt-next/unstable` resolves under the same conditions as `gt-next` and exports `useGT()` instead of `t`. `gt-next/unstable/server` exports an async `getGT()` for the request locale.
- `gt-tanstack-start/unstable` adds an async `getGT()` bound to the request on the server and to the browser locale in the browser.
- `gt-node/unstable`: an async `getGT()` for the current `withGT()` locale.

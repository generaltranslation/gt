---
"@generaltranslation/react-core": minor
"gt-react": minor
"gt-react-native": minor
"gt-next": minor
"gt-tanstack-start": minor
"gt-node": minor
---

Add tagged-template message trees from `gt-i18n` to the framework entries. Each main entry exports the `plural`, `selectordinal`, `select`, `number`, `date`, `part`, and `derive` helpers, `n` for the plural count, and the `GT`, `GTOptions`, `Placeholder`, and `Part` types. The `t` tag is only for client-rendered (SPA) apps, so only `gt-react`'s browser entry and `@generaltranslation/react-core/pure` export it; server-rendered apps use `useGT()` in components and `getGT()` on the server.

- `@generaltranslation/react-core`: `useGT()` from `/hooks` returns a GT bound to the render locale. It reads the provider's translations, then the translation cache, and in dev hot reload it sends misses for runtime translation and re-renders when they arrive. `t` from `/pure` works only in client-rendered (SPA) apps, where module-level calls work too; in a server-rendered app every call throws in development and renders the source with an error in production. Messages render untranslated when i18n is disabled or the requested locale needs no translation.
- `gt-react` and `gt-react-native`: the react-core client surface, without `t` in React Native. Under `react-server`, `gt-react` resolves to an RSC variant, where `useGT()` waits for the request locale's translations and `t` is not exported.
- `gt-next` exports `useGT()` instead of `t`. `gt-next/server` exports an async `getGT()` for the request locale.
- `gt-tanstack-start` exports an async `getGT()` bound to the request on the server and to the browser locale in the browser. It exports no `t`, since TanStack Start renders on the server.
- `gt-node`: an async `getGT()` for the current `withGT()` locale.

---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-react': minor
---

Add an experimental global `m` to `/unstable` entries, the `useMessages()` counterpart of `t`: `` m(msg`Hello, ${{ name }}!`) `` renders a message from `msg()` with the current locale, without calling a hook. `gt-i18n/unstable` exports an `m` bound to the condition store. `@generaltranslation/react-core/unstable` and `gt-react/unstable` export an `m` that, like `t`, works only in client-rendered (SPA) apps, including at module level. In server-rendered apps, it throws in development and logs an error and renders the source in production; use `useMessages()` or `getMessages()` instead. Server components and `gt-react-native/unstable` do not export it, for the same reasons as `t`.

---
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt-i18n': minor
'gt-node': minor
---

Tidy the `<T>` props and the `/unstable` type exports:

- `<T>` no longer declares or reads the internal props `_locale`, `_enableI18n`, and `_renderPreparedT`; it always renders in the locale from context. The RSC `T` and `Tx` from `@generaltranslation/react-core/components-rsc` still take them, and gt-next passes them there.
- `gt-i18n/unstable` and the framework `/unstable` entries export the type of a `` part`...` `` value as `Part` instead of `Fragment`, which collided with React's `Fragment`.

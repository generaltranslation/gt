---
'gt-react': minor
---

Add the `gt-react/static-runtime` and `gt-react/static-runtime/intl` entries, which code compiled with `@generaltranslation/compiler`'s experimental `experimentalStaticRuntime` option imports in place of gt-react. The first holds a formatter for message trees of text, values, `select` and `plural` in the build's locale, which imports nothing and builds its Intl objects on first use, and an `initializeGTSPA()` that does nothing. The second formats messages with a number, a date or a time through the runtime's own formatter. Neither loads translations, reads a locale, or includes gt-react's cache, configuration or stores.

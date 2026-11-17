---
'gt-react': minor
---

Add the `gt-react/static-runtime` entry, which code compiled with `@generaltranslation/compiler`'s experimental `experimentalStaticRuntime` option imports in place of gt-react: a formatter for message trees in the build's locale, and an `initializeGTSPA()` that does nothing. It loads no translations and reads no locale, and none of gt-react's cache, configuration or stores.

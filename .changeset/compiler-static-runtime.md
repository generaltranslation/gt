---
'@generaltranslation/compiler': minor
---

Add the experimental `experimentalStaticRuntime` option (or the `GT_STATIC_RUNTIME` environment variable) for per-locale builds of single-page apps that replace source content (`experimentalStaticLocale` with `experimentalReplaceSource`). The build leaves the GT runtime out: every `t` template from `gt-react/unstable` and every `<T>` is resolved for the build's locale, a template with variables formats its message tree through `gt-react/static-runtime`, and `initializeGTSPA()` becomes a call that does nothing. A missing translation renders its source with a build warning. Anything that would still need the runtime fails the build with its file and line: `useGT()`, `msg()`, the stable `t()`, a `GTProvider`, the locale hooks and selectors, variable components, a `<T>` the build cannot replace, a template that is not static, and `maxChars`.

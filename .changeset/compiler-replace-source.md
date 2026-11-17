---
'@generaltranslation/compiler': minor
---

Add the experimental `experimentalReplaceSource` option (or the `GT_REPLACE_SOURCE` environment variable) for per-locale builds of single-page apps. With `experimentalStaticLocale` set, each call site that embeds a translation has its source content replaced by the static locale's translation, so it ships no source text and needs no lookup: `<T>` becomes the JSX its translation renders, keeping elements, variables, `<Plural>` and `<Branch>` working at runtime, and a `t` or `gt` template from `/unstable` becomes its translated template. A call site whose translation does not match its source keeps the embedded translation. Enabling it without a static locale fails the production build.

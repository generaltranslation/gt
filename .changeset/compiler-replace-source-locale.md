---
'@generaltranslation/compiler': patch
---

`experimentalReplaceSource` now also applies to a per-locale build for the source locale (`experimentalStaticLocale` set to the default locale or to a dialect that needs no translation): each `<T>` becomes a `Fragment` of its own children, which is what it renders there, so a single-page app whose `<T>` calls are all replaced no longer bundles the `<T>` runtime. Variables, `<Plural>` and `<Branch>` keep working at runtime, and a `<T>` with a shape the translated builds also keep (for example `<RelativeTime>` or a `locales` prop) stays a component. No translations need to be embedded for this.

---
'@generaltranslation/react-core': minor
'gt-react': minor
---

Add the internal `GtInternalPrecomputedText` and `GtInternalPrecomputedJsx` components, which `@generaltranslation/compiler` renders a static `<T>` with when its `experimentalPrecomputeJsx` option is on. They render what `<T>` renders for the same children, locale and translation, read the locale and the translation once per render, and hold no subscription. An app whose `<T>` calls are all precomputed no longer bundles `<T>` and its render pipeline. They cannot render in a React Server Component.

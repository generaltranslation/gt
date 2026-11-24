---
'@generaltranslation/react-core': minor
---

Add `InternalTranslationsSeed` to `@generaltranslation/react-core/components`, for framework packages: it adds translations to those of the `GTProvider` above it, and under those of a `GTProvider` below it. `InternalGTProvider` adds the translations of a seed above it under its own; with no seed above it, it behaves as before.

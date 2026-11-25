---
'gt-next': patch
---

`isLocaleSupported` returns `boolean` instead of the type predicate `locale is string`. It returns `false` for strings that are not supported locales, so the predicate narrowed a `string | number` to `number` when it returned `false`. Check `typeof locale === 'string'` yourself where you relied on the narrowing.

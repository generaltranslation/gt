---
'gt-next': patch
---

`gt-next/link`, `useLocalizeHref()` and `getLocalizeHref()` no longer prefix paths that don't match the `pathRegex` passed to `withGTConfig()`. The middleware leaves those paths unlocalized, so a prefixed link to them, such as `/fr/api/export`, would not resolve.

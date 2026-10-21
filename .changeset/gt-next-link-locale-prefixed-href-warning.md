---
'gt-next': patch
---

`gt-next/link`, `useLocalizeHref()` and `getLocalizeHref()` now log a warning once in development when an href already starts with a configured locale and is prefixed again, for example `/de/about` rendering as `/fr/de/about`. The href output is unchanged.

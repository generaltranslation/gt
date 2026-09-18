---
'gt-react': patch
---

Resolve the browser condition store's region from the `region` prop before the persisted region cookie, matching how the locale and `enableI18n` conditions already resolve. A stale `generaltranslation.region` cookie no longer overrides the region the server rendered with.

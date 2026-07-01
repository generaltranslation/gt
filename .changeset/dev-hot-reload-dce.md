---
"@generaltranslation/react-core": patch
"gt-i18n": patch
---

Statically gate dev hot-reload code paths (tracked resolver invalidation, missing-translation queue, T hot-reload fallbacks, getGT dev preload) behind `process.env.NODE_ENV !== 'production'` so bundlers can drop them from production builds. Behavior is unchanged: the existing runtime `isDevHotReloadEnabled()` check still applies in development.

---
'@generaltranslation/compiler': minor
'gt-i18n': minor
'gt-react': minor
---

Serve locale twin SPAs. With the `'locale-twins'` translation splitting strategy, `vite build` now rewrites `index.html` so the browser loads its locale's entry twin: a small bootstrap picks the locale (locale cookie, then `navigator.languages`, then the default locale), sets `<html lang>`, modulepreloads that locale's twinned files, and loads the entry twin. The bootstrap is inline by default (its CSP hash is in `gt-locale-twins-report.json`) or an external file with `localeTwins.spaBootstrap: 'external'`. Set `localeTwins.localeCookieName` when the app uses a custom locale cookie.

Apps that run their own server can pick the locale per request instead with the new edge-safe `gt-react/locale-twins` helper: `createLocaleTwinDocument({ html })` returns the document for the request locale (cookie, then `Accept-Language`, then default) with `Vary: Cookie, Accept-Language` and no shared caching; `getLocaleTwinAssetHeaders()` gives immutable caching headers for twins and shared files. Web-only: gt-react-native has no equivalent.

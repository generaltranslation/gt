---
'gt': patch
---

`gt init` no longer installs gt-react or reports a finished setup on Next.js Pages Router apps. It leaves the app unchanged, links the Pages Router quickstart as a manual step, and adds `defaultLocale` to `locales` in `gt.config.json` so the quickstart's Next.js `i18n` config builds.

---
'gt': patch
---

From `main` (gt 2.28.0–2.28.1): `gt init --create-project` lists the organizations you can use (name and ID) when a noninteractive run needs `--org-id` or gets one you can't access (#2642). `gt init` no longer installs gt-react or reports a finished setup on Next.js Pages Router apps: it leaves the app unchanged, links the Pages Router quickstart as a manual step, and adds `defaultLocale` to `locales` in `gt.config.json` so the quickstart's Next.js `i18n` config builds (#2645). `--save-local` no longer replaces a Mintlify `docs.json` translation with an empty one when its languages are split into `$ref` files (#2707).

---
'gt': patch
---

`gt init` now handles Next.js apps with `cacheComponents: true`. A fresh app gets the Cache Components setup (root layout under `app/[locale]`, `getLocale`, `getRegion`, and a proxy) so `next build` passes; any other app keeps its root layout unchanged and gets instructions for the manual setup.

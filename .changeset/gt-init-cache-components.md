---
'gt': patch
---

`gt init` now handles Next.js apps with `cacheComponents: true`. It moves the app's routes under `app/[locale]`, rewrites imports that cross the move, and adds `getLocale`, `getRegion`, and a proxy so `next build` passes. Apps it cannot migrate safely, such as apps with an existing proxy or middleware, keep their root layout unchanged and get instructions for the manual setup.

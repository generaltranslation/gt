---
'gt': minor
---

`gt init` now sets up React Router framework apps, including Shopify Hydrogen, with `gt-react`: it writes `app/loadTranslations.ts` and configures an `app/root.tsx` shaped like the create-react-router or Hydrogen starters to load each visitor's locale and translations in the root loader. Other roots get manual steps. SPA mode, pre-rendering, RSC Framework Mode, an `appDirectory` other than `app`, or a `gt-react` older than 11.1.3 stop setup before any change.

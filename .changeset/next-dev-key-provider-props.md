---
'gt': patch
'gt-next': patch
'gt-i18n': patch
---

Fix `next build` failing right after `gt init`. For Next.js App Router, `gt init` now saves `GT_PROJECT_ID` and `GT_API_KEY` to `.env.local` instead of `NEXT_PUBLIC_` variables. gt-next uses `GT_API_KEY` for hot reload during `next dev`, where the server `GTProvider` passes it to client code, and no longer fails production builds when a development key is present. gt-next no longer reads `GT_DEV_API_KEY`. `NEXT_PUBLIC_GT_PROJECT_ID` and `NEXT_PUBLIC_GT_DEV_API_KEY` still work in development, and production builds ignore the development key. gt-i18n adds an internal `I18nConfig.setDevCredentials()` so an initialized client can receive credentials later.

---
'gt': patch
'gt-next': patch
'gt-i18n': patch
---

Fix `next build` failing right after `gt init`. For Next.js App Router projects, `gt init` now writes the server-only `GT_PROJECT_ID` and `GT_DEV_API_KEY` instead of `NEXT_PUBLIC_` variables, so the development key never reaches a client bundle. gt-next reads the development key only in development and no longer rejects one during `next build`. In development, the server `GTProvider` hands the key to the client so client components keep hot reload. gt-i18n adds an internal `setDevCredentials()` to `I18nConfig` and `I18nCache` so an initialized client can receive those credentials later. Pages Router projects still use `NEXT_PUBLIC_` variables.

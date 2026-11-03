---
'gt': patch
'gt-next': patch
---

Fix `next build` failing right after `gt init`. For Next.js App Router, `gt init` now saves the server-only `GT_PROJECT_ID` and `GT_DEV_API_KEY` to `.env.local` instead of `NEXT_PUBLIC_` variables. gt-next reads development keys only in development and no longer fails production builds when one is present, so production bundles never include it. During `next dev`, `withGTConfig` passes the server-only key to client code for hot reload. Pages Router setups keep `NEXT_PUBLIC_GT_DEV_API_KEY`, which production builds now ignore as well.

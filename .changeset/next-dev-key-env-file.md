---
'gt': patch
'gt-next': patch
---

Fix `next build` failing right after `gt init`. For Next.js (App Router and Pages Router), `gt init` now saves `GT_PROJECT_ID` and `GT_API_KEY` to `.env.local` instead of `NEXT_PUBLIC_` variables, so one key works in development and production. gt-next no longer fails production builds when a development key is present, and no longer reads `GT_DEV_API_KEY`. `NEXT_PUBLIC_GT_PROJECT_ID` and `NEXT_PUBLIC_GT_DEV_API_KEY` still work, and the `GT_*` names take precedence.

- During `next dev`, `withGTConfig` exposes `GT_PROJECT_ID` and `GT_API_KEY` to client code for hot reload, so whatever key `GT_API_KEY` holds reaches the browser in development. Production builds never include it. To keep the key out of the browser in development, set `runtimeUrl: ''` in `withGTConfig`, which turns off runtime translation.
- With `GT_API_KEY` in `.env.local`, a local `next build` or `next start` now uses it for runtime translation, the same as a production deployment with `GT_API_KEY` set.
- The `gt` CLI prefers your login over a `GT_API_KEY` that comes from an env file, because that key is the app's runtime key. A `GT_API_KEY` set in the shell or CI still takes precedence.

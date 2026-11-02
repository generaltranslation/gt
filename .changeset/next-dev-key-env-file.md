---
'gt': patch
'gt-next': patch
---

Fix `next build` failing right after `gt init`. For Next.js projects, `gt init` now saves the development credentials to `.env.development.local`, which `next dev` loads and `next build` skips. Previously it used `.env.local`, which `next build` also loads, and gt-next rejects a development key in production builds. The CLI now reads `.env.development.local` too, and it warns when `.env.local` still has a development key from an earlier setup. gt-next's production-build error now names the variable that holds the development key and explains how to fix it.

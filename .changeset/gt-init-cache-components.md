---
'gt': patch
---

`gt init` no longer breaks `next build` on Next.js apps with `cacheComponents: true`. Setup still installs gt-next and adds `withGTConfig()`, but it leaves the root layout without `<GTProvider>` and links the Cache Components guide for the remaining steps. The `--json` result reports them as `needs_human_action`.

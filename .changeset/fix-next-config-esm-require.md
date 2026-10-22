---
'gt-next': patch
---

Fix `withGTConfig` failing with "The installed Next.js version could not be resolved ... require is not defined" when `gt-next/config` is imported from an ESM Next config (`next.config.mjs`, `next.config.mts`, or `next.config.js` with `"type": "module"`).

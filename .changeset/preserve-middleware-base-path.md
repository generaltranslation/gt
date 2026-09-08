---
'gt-next': patch
---

Preserve the configured Next.js base path in middleware rewrites and redirects.

Handle app routes and locale prefixes that repeat the base path without dropping a segment or redirecting to themselves.

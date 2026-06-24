---
"gt-next": patch
---

Patch a security issue in the locale middleware where a redirect target could
resolve to an unintended origin. Redirect and rewrite targets are now
constrained to the request's own origin.
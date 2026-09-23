---
'gt-react': patch
---

Use server-provided locale and condition props as the only rendered state in server-rendered apps. Condition setters write cookies for middleware and request a reload; provider-free SPA apps keep their cookie-backed behavior.

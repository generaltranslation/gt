---
"gt-next": patch
---

Fix string-valued `pathConfig` aliases so localized URLs rewrite to their shared pages, including dynamic and catch-all routes. String aliases now participate in default-locale URL detection just like equivalent per-locale objects, so an unprefixed default-locale alias takes precedence over an ordinary locale cookie.

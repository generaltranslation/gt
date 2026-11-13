---
'@generaltranslation/icu': patch
---

perf(icu): resolve each locale or locale list once in `formatMessage` instead of on every call, using a cache bounded to 64 entries

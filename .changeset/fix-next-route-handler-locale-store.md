---
'gt-next': patch
---

Fix route handler locale registration so `getGT()` honors locales registered with `registerLocale()` before falling back to request locale resolution.

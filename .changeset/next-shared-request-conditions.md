---
'gt-next': patch
---

perf(next): server hooks (`useGT`, `useMessages`, `useTranslations`, `useLocale`, `useRegion`) and `getGT`, `getMessages`, `getTranslations`, `getRequestConditions` share one settled promise per server render, so components no longer suspend and replay and the request locale is resolved once per render

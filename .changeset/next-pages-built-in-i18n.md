---
'gt-next': patch
---

Delegate Pages Router locale routing and active-locale resolution to Next.js internationalized routing. Pages data wrappers prefer `context.locale` while retaining the previous request detector as a compatibility fallback, `withGTConfig` selects `NEXT_LOCALE` when Next.js locale detection is enabled, and applications can navigate with the Pages Router locale option through the existing provider reload callback. App Router middleware and `GTProvider` behavior are unchanged.

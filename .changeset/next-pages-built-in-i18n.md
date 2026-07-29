---
'gt-next': patch
---

Delegate Pages Router locale routing and active-locale resolution to Next.js internationalized routing. Pages data wrappers prefer `context.locale` while retaining the previous request detector as a compatibility fallback, locale selectors persist `NEXT_LOCALE` and navigate with the Pages Router locale option, and the explicit provider props continue to carry locale-scoped translations. App Router middleware behavior is unchanged.

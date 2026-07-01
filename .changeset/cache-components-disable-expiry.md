---
"gt-i18n": patch
"gt-next": patch
---

Use Next.js caching semantics for Cache Components by disabling GT cache expiry and development hot reload runtime translation.

Async translation and dictionary lookup boundaries now keep synchronous access to the loaded snapshot, so APIs like `getGT` and `getTranslations` can still resolve strings after cache expiry is delegated to Next.js.

Global singleton setup now preserves the first initialized instance instead of replacing it on later initialization attempts.

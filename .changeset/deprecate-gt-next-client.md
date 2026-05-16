---
"gt-next": patch
"gt-react": patch
---

Deprecate the `gt-next/client` entry point in favor of root `gt-next` exports, port its missing hooks to `gt-next`, and add `GTClientProvider` to `gt-react/client` as the replacement for the old `gt-next/client` provider alias.

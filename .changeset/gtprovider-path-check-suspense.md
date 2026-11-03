---
'gt-next': patch
---

`GTProvider` no longer fails `next build` with Cache Components on routes with dynamic segments that aren't prerendered. Its pathname check now renders in its own `<Suspense>` boundary instead of reading `usePathname()` while the shell is prerendered.

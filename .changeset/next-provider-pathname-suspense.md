---
'gt-next': patch
---

Fix `next build` failing with Cache Components (`cacheComponents: true`) on dynamic routes that have no `generateStaticParams`, such as `app/[locale]/orders/[id]`. `GTProvider` read `usePathname()` outside a Suspense boundary, which made Next.js treat the whole page as uncached request data. The pathname check now runs in its own Suspense boundary, so the rest of the page still prerenders.

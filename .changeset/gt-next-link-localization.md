---
'gt-next': patch
---

Improve `gt-next/link` locale prefixing and share routing options with the middleware:

- `withGTConfig()` now accepts the `createNextMiddleware()` routing options (`localeRouting`, `prefixDefaultLocale`, `enableSmartRouting`, `ignoreSourceMaps`, `pathConfig`, `routeOverrides`, `localeRoutes`). Options passed directly to `createNextMiddleware()` still take precedence.
- `gt-next/link` no longer prefixes default-locale links when `prefixDefaultLocale` is `false`, avoiding a middleware redirect. Explicit `locale` props for the default locale stay prefixed unless `enableSmartRouting` is `false`. Set these options in `withGTConfig()` so Link can read them; `createNextMiddleware()` warns in development when its values differ.
- Add `useLocalizeHref()` to `gt-next/link`. It returns a function that localizes hrefs the same way `<Link>` does, for navigation that doesn't render a link, such as `router.push()`.

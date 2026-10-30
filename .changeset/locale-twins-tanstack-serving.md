---
'gt-tanstack-start': minor
'@generaltranslation/react-core': minor
'gt-react': minor
---

Serve TanStack Start apps with locale twins. The new server export `createLocaleTwinAssets({ manifest })` from `gt-tanstack-start` points the document's entry script, module preloads, early hints, and the client router manifest at the request locale's twins. Pass it to `createStartHandler({ transformAssets })` in your server entry (`transformAssetUrls` on TanStack Start versions before `transformAssets`), with `manifest` imported from `virtual:gt-locale-twins-manifest`. The locale is resolved exactly as for SSR (path locale with `localeRouting`, then the locale cookie, then `Accept-Language`, then the default; the default locale's twins when the enable-i18n cookie is `false`), the transform is created per request (`cache: false`), and it needs no file system access, so it runs on edge runtimes. A `null` manifest (dev) leaves URLs unchanged; a manifest with an unknown format version is rejected.

With `files.gt.splitting: 'locale-twins'`, `setupRouterGTIntegration` still loads the request locale's translations on the server before rendering, but no longer sends a translations snapshot to the client in production (`vite dev`, which serves no twins, keeps it), and it marks SSR documents with `Vary: Cookie, Accept-Language` and, unless a route or the request sets its own, `Cache-Control: private, no-cache`. Locale twin clients never call the translation loader.

Locale twins need the compiler: enable it with `gtTanstackStart({ experimentalCompilerOptions: { type: 'babel' } })`, which now also accepts the compiler's `localeTwins` build options.

The `translations` prop of `GTProvider` is now optional, for apps that use locale twins.

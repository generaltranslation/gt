---
'gt-tanstack-start': minor
---

TanStack Start setup now takes two lines: add `gtTanstackStart()` from `gt-tanstack-start/plugin/vite` to your Vite plugins, and call `setupRouterGTIntegration({ router })` in `getRouter()`. The plugin reads `gt.config.json` and generates the translation loader from `files.gt.output`. Like gt-next, it can also run the experimental GT compiler: install `@generaltranslation/compiler` and set `experimentalCompilerOptions: { type: 'babel' }`. The router integration loads translations during SSR, hydrates them on the client, and renders `GTProvider` for you, so apps no longer need `initializeGT()`, a `loadTranslations` file, a root-route loader, `<GTProvider>`, or `gtMiddleware`. The previous manual setup keeps working.

When `localeRouting` is enabled, `setupRouterGTIntegration` also installs a router URL rewrite: routes and links stay locale-free, non-default locales are prefixed in the URL, and the default locale stays unprefixed. If your app already handles locale prefixes with `{-$locale}` route segments or its own rewrite, pass `localeRewrite: false` to keep your setup.

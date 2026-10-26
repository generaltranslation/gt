---
'gt-tanstack-start': major
---

TanStack Start setup now takes two lines: add `gtTanstackStart()` from `gt-tanstack-start/plugin/vite` to your Vite plugins, and call `setupRouterGTIntegration({ router })` in `getRouter()`. The plugin reads `gt.config.json` and generates the translation loader from `files.gt.output`. Like gt-next, it can also run the experimental GT compiler: set `experimentalCompilerOptions: { type: 'babel' }`. The compiler now installs with gt-tanstack-start, as with gt-next, and loads only when enabled. The router integration loads translations during SSR, hydrates them on the client, and renders `GTProvider` for you, so apps no longer need a `loadTranslations` file, a root-route loader, or `<GTProvider>`.

Settings that `gt.config.json` cannot hold are `gtTanstackStart()` options: cookie names, `cacheExpiryTime`, `batchConfig` and `runtimeTranslation`, plus `dictionary`, `loadDictionaryPath` and `loadTranslationsPath` files. Without these options, the plugin finds `dictionary` and `loadDictionary` files in the app root or `src/`, as gt-next does.

The previous manual setup is removed. Switch to the Vite plugin and the router integration:

- `initializeGT()` is removed. Pass its settings to `gtTanstackStart()` instead.
- `gtMiddleware` is removed. Delete it from `requestMiddleware`.
- The `gt-tanstack-start/server` entrypoint is removed. Import `getLocale`, `getGT` and the other translation functions from `gt-tanstack-start`, which provides them on the server and in the browser.
- The `GTProvider` and `getTranslationsSnapshot` exports are removed, and so is the root-route loader that used them. The router integration renders the provider.
- `parseLocale()` is removed. Use `getLocale()`.
- The `InitializeGTParams` type is removed.

When `localeRouting` is enabled, `setupRouterGTIntegration` also installs a router URL rewrite: routes and links stay locale-free, non-default locales are prefixed in the URL, and the default locale stays unprefixed. If your app already handles locale prefixes with `{-$locale}` route segments or its own rewrite, pass `localeRewrite: false` to keep your setup.

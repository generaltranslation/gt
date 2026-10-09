<p align="center">
  <a href="https://generaltranslation.com/docs/tanstack-start">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/tanstack-start"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-tanstack-start

Automatic i18n for TanStack Start.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-tanstack-start
npm install gt --save-dev
```

## Quick Start

```bash
npx gt init
```

`gt init` adds the Vite plugin and router integration for you, and sets the root route's `<html lang>` to the resolved locale. To set them up by hand:

```ts
// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackStart(), react(), gtTanstackStart()],
});
```

```ts
// src/router.tsx
import { createRouter } from '@tanstack/react-router';
import { setupRouterGTIntegration } from 'gt-tanstack-start';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({ routeTree });
  setupRouterGTIntegration({ router });
  return router;
}
```

The integration wraps the root route in `GTProvider`, so the root shell can use GT hooks, for example to set the document language:

```tsx
// src/routes/__root.tsx
import type { ReactNode } from 'react';
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { useLocale } from 'gt-tanstack-start';

export const Route = createRootRoute({
  component: () => (
    <RootDocument>
      <Outlet />
    </RootDocument>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={useLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

The plugin reads `gt.config.json` (resolved from the current working directory; pass `gtTanstackStart({ config: 'path/to/gt.config.json' })` to change it) and loads translations from `files.gt.output` (also resolved from the working directory, as the `gt` CLI does). The router integration loads translations during SSR, hydrates them on the client, and renders `GTProvider`, so no root-route loader or `<GTProvider>` is needed. The browser loads the same config, so the plugin leaves `apiKey` and `devApiKey` out of it; keep keys in environment variables.

Settings that `gt.config.json` cannot hold are plugin options, which override the file:

```ts
gtTanstackStart({
  // Cookie names, translation caching and batching, and runtime translation
  localeCookieName: 'app.locale',
  cacheExpiryTime: null,
  batchConfig: { maxBatchSize: 10 },
  runtimeTranslation: { timeout: 5000 },
  // Files, relative to the working directory. By default the plugin uses
  // dictionary.(ts|js|json) and loadDictionary.(ts|js) in the app root or
  // src/, and src/loadTranslations.* before files.gt.output.
  dictionary: 'src/i18n/dictionary.ts',
  loadDictionaryPath: 'src/i18n/loadDictionary.ts',
  loadTranslationsPath: 'src/i18n/loadTranslations.ts',
});
```

Changes to `gt.config.json` or these options apply after the dev server restarts.

To run the experimental GT compiler, which adds build-time hashes and build checks, install `@generaltranslation/compiler` and pass `gtTanstackStart({ experimentalCompilerOptions: { type: 'babel' } })`. It is off by default, as in gt-next.

When `localeRouting` is enabled, the integration also rewrites URLs so non-default locales are prefixed (`/fr/about`) while your routes and links stay locale-free. Pass `setupRouterGTIntegration({ router, localeRewrite: false })` if your app handles locale prefixes itself.

Then translate:

```jsx
import { T } from 'gt-tanstack-start';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/tanstack-start) for guides and API reference.

## Migrating from the previous setup

`initializeGT()` and `gtMiddleware` are deprecated. Apps that use them, a root-route loader and `<GTProvider>` keep working until a future major release. To move to the setup above:

```diff
 // vite.config.ts
+import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite';
-plugins: [tanstackStart(), react()],
+plugins: [tanstackStart(), react(), gtTanstackStart()],

 // src/router.tsx
-import { initializeGT } from 'gt-tanstack-start';
-import gtConfig from '../gt.config.json';
-import loadTranslations from './loadTranslations';
-initializeGT({ ...gtConfig, loadTranslations });
+import { setupRouterGTIntegration } from 'gt-tanstack-start';
 export function getRouter() {
   const router = createRouter({ routeTree });
+  setupRouterGTIntegration({ router });
   return router;
 }

 // src/start.ts
-requestMiddleware: [gtMiddleware],
+requestMiddleware: [],

 // src/routes/__root.tsx
-loader: async () => ({ locale: getLocale(), translations: await getTranslationsSnapshot(getLocale()) }),
-<GTProvider locale={locale} translations={translations}>{children}</GTProvider>
+{children}
```

- Other `initializeGT()` settings move to the plugin options above. A `dictionary` or `loadDictionary` function moves to a file.
- A `src/loadTranslations.*` file keeps working. The plugin can also load `files.gt.output` itself, so a loader generated by `gt init` can be deleted.
- With `localeRouting`, the integration adds locale prefixes to URLs. If your routes declare `{-$locale}` segments, remove them, or pass `localeRewrite: false`.

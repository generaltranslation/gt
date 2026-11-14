---
'gt-vue': minor
'@generaltranslation/vue-extractor': patch
---

gt-vue runs on gt-i18n's translation cache, like gt-react and gt-svelte. It loads translations from the GT CDN when you set `projectId` and no `loadTranslations`, reads `GT_PROJECT_ID` and `GT_API_KEY` from the environment, and in development translates new `<T>` content and `useGT()`/`useMessages()` strings on demand.

- New `initializeGT(config)` sets up the configuration and translation cache once per process. Translations are shared across server requests; each request keeps its own locale in its `createGT()` plugin.
- `createGT()` now takes only `locale` and `localeCookieName`. Move `defaultLocale`, `customMapping` and `loadTranslations` to `initializeGT()`, and call it before `createGT()`:

  ```ts
  // Before
  app.use(createGT({ defaultLocale: 'en', loadTranslations, locale }));

  // After
  initializeGT({ defaultLocale: 'en', locales: ['fr'], loadTranslations });
  app.use(createGT({ locale }));
  ```

- `initializeGTSPA(config)` keeps its signature and calls `initializeGT()` for you.
- New `gt-vue/vite` subpath exports `gtVue()`, a Vite plugin that passes `GT_PROJECT_ID` to client code and `GT_API_KEY` only while the dev server runs: `plugins: [vue(), gtVue()]`.
- A failed translation load follows gt-i18n's policy: `setLocale()` and `loadTranslations()` reject in development, and in production the error is logged and source content renders.
- `@generaltranslation/vue-extractor` recognizes `initializeGT` as a gt-vue export.

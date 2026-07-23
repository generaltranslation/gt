# gt-i18n

## 1.0.8

### Patch Changes

- Updated dependencies [[`bbf4eb0`](https://github.com/generaltranslation/gt/commit/bbf4eb0cf77160baa615776619acd7afe35697ba), [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - generaltranslation@9.0.4
  - @generaltranslation/format@0.1.3

## 1.0.7

### Patch Changes

- [#1916](https://github.com/generaltranslation/gt/pull/1916) [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify `gt.config.json` types so complete config objects can be spread into compiler plugins and runtime initializers while file settings remain optional.

- Updated dependencies [[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - generaltranslation@9.0.3

## 1.0.6

### Patch Changes

- [#1901](https://github.com/generaltranslation/gt/pull/1901) [`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Forward the top-level `modelProvider` configuration to runtime translation requests while allowing explicit runtime metadata to override it.

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2

## 1.0.5

### Patch Changes

- Updated dependencies [[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - generaltranslation@9.0.1

## 1.0.4

### Patch Changes

- [#1856](https://github.com/generaltranslation/gt/pull/1856) [`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Flatten the internal i18n cache structure: the locale-cache layer is inlined into `I18nCache`, the in-flight promise dedupe shared by the caches is extracted into one helper, and the dev-only prefetch machinery is statically gated behind `process.env.NODE_ENV !== 'production'` so production bundles drop it. No public API changes; `gt-i18n/internal` and `gt-i18n/internal/types` exports are unchanged.

- [#1855](https://github.com/generaltranslation/gt/pull/1855) [`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Collapse the I18nCache constructor-time validation layer into a single helper. Observable behavior is unchanged: the same warnings are logged when a custom `runtimeUrl` is configured without GT credentials, and providing `loadDictionary` without a source `dictionary` still throws. The unreachable validation branches are removed, slightly shrinking browser bundles.

## 1.0.3

### Patch Changes

- [#1861](https://github.com/generaltranslation/gt/pull/1861) [`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Skip interpolation in compiler-injected string prefetch calls so dev hot reload no longer logs "String interpolation failed" for messages with placeholders

## 1.0.2

### Patch Changes

- [#1858](https://github.com/generaltranslation/gt/pull/1858) [`006e071`](https://github.com/generaltranslation/gt/commit/006e071bf87ffe80f2d18958ddfa8f18cc2d85d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Accept parsed `gt.config.json` objects in the compiler and React SPA configuration types.

- [#1846](https://github.com/generaltranslation/gt/pull/1846) [`7fb4a74`](https://github.com/generaltranslation/gt/commit/7fb4a74c52065694a40deafcf4596acc09e17f58) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add `parseLocale(request)` to resolve server-rendered React locales from the configured cookie, the `Accept-Language` header, or the default locale.

  Share cookie and `Accept-Language` parsing across the framework packages.

- [#1848](https://github.com/generaltranslation/gt/pull/1848) [`1f33d5f`](https://github.com/generaltranslation/gt/commit/1f33d5f76ffc879d2d21aa2508e07e1d3b66c4e3) Thanks [@bgub](https://github.com/bgub)! - Remove unused dependencies: `@generaltranslation/supported-locales` from gt-react, gt-next, gt-i18n, and @generaltranslation/react-core, and `@generaltranslation/format` from gt-react. Nothing in these packages imports them, so this only reduces install weight.

## 1.0.1

### Patch Changes

- Updated dependencies [[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:
  - @generaltranslation/supported-locales@2.1.3

## 1.0.0

### Major Changes

- [#1816](https://github.com/generaltranslation/gt/pull/1816) [`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b) Thanks [@bgub](https://github.com/bgub)! - Add a config-aware `resolveCanonicalLocale` helper and remove the public `getGTClass` helper.

- [#1820](https://github.com/generaltranslation/gt/pull/1820) [`1f53e42`](https://github.com/generaltranslation/gt/commit/1f53e420e9a6475f85cf27e1cd0c9c89f4beeb36) Thanks [@bgub](https://github.com/bgub)! - Clean up the `gt-i18n` public API surface by removing dead subpaths, internal exports, and unused types.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`c1e0a0f`](https://github.com/generaltranslation/gt/commit/c1e0a0f837da440eeed84af10b553dee24bfc936) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove deprecated translation options. The `context` dictionary option has been removed in favor of `$context`, and the `$_locales` inline option has been removed in favor of `$locale`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Minor Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`b3bb391`](https://github.com/generaltranslation/gt/commit/b3bb391d33041680e2d62b6a7c9b05662946544f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.
  - `gt-i18n`: Removed the unused React locale cookie name from the shared GT config type.
  - `@generaltranslation/react-core`: `ReactI18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName`, exposes getters that fall back to the default names, and exports the default storage names from the `pure` entrypoint.
  - `gt-next`: Imports default cookie names from the React Core `pure` entrypoint instead of the removed React Core cookie constants subpath.
  - `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
  - `gt-react-native`: Native condition storage now resolves its store keys from `I18nConfig`, matching `gt-react` behavior.
  - `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Use Next.js caching semantics for Cache Components by disabling GT cache expiry and development hot reload runtime translation.

  Async translation and dictionary lookup boundaries now keep synchronous access to the loaded snapshot, so APIs like `getGT` and `getTranslations` can still resolve strings after cache expiry is delegated to Next.js.

  Global singleton setup now preserves the first initialized instance instead of replacing it on later initialization attempts.

- [#1818](https://github.com/generaltranslation/gt/pull/1818) [`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a) Thanks [@bgub](https://github.com/bgub)! - Clean up the `generaltranslation` public API surface for the next major.

  Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`42a440f`](https://github.com/generaltranslation/gt/commit/42a440ff3420bdbdb35ed24f9a5af1c9040eaf66) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Gate duplicate singleton initialization warnings behind `_GENERALTRANSLATION_LOG_LEVEL=DEBUG`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`fd22c68`](https://github.com/generaltranslation/gt/commit/fd22c68978af50ce519dc06c7b887d3fa67181ae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Defer the missing-projectId and missing-translation-loader warnings from I18nCache construction to the first translation loader invocation. Clients of server-rendered apps receive translations via updateTranslations() and never invoke the fallback loader, so they no longer log spurious warnings on initialization. Explicitly disabling translation loading with cacheUrl: null no longer logs at all, and explicitly setting cacheUrl to the default GT CDN URL alongside a projectId is now classified as GT remote loading.

- [#1811](https://github.com/generaltranslation/gt/pull/1811) [`bea8233`](https://github.com/generaltranslation/gt/commit/bea8233d8b055980483cb2e226157f6adcbd8c2b) Thanks [@bgub](https://github.com/bgub)! - Statically gate dev hot-reload code paths (tracked resolver invalidation, missing-translation queue, T hot-reload fallbacks, getGT dev preload) behind `process.env.NODE_ENV !== 'production'` so bundlers can drop them from production builds. Behavior is unchanged: the existing runtime `isDevHotReloadEnabled()` check still applies in development.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`04b5064`](https://github.com/generaltranslation/gt/commit/04b50645675abb9e927a82056b249b50f0907fcc) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Restore namespace scoping for getTranslations and server useTranslations.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`328795b`](https://github.com/generaltranslation/gt/commit/328795bf730296658a57b7132bbd1e0bbff2fd62) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Store the GT services enabled flag on the i18n config singleton.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`3d95277`](https://github.com/generaltranslation/gt/commit/3d95277a057b28fffc73b3fa616210bdcb447e85) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove unused internal exports and dead utility code.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`c5364f9`](https://github.com/generaltranslation/gt/commit/c5364f977ffb4b387ad39206e6ed626bbeec56f3) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Slim the i18n cache event surface by replacing the generic EventEmitter base class with a single cache-miss listener and removing unused cache helper methods.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d863bcf`](https://github.com/generaltranslation/gt/commit/d863bcf05770c336c98b2b2fae8534c90f00df51) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove deprecated i18n cache lifecycle hooks and unused cache events.

  The cache subscription surface now only exposes `translations-cache-miss`, which is used for runtime translation updates. Deprecated lifecycle constructor callbacks and unused locale/dictionary cache hit/miss events have been removed.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`11ecf87`](https://github.com/generaltranslation/gt/commit/11ecf876a1221b9dbce9fc0c0f0804101558c8a7) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the unused `condition-store/localeResolver` module from `gt-i18n/internal`.

  `determineSupportedLocale`, `resolveSupportedLocale`, and `createLocaleResolver` were thin wrappers over `getI18nConfig().<method>()`. They had no consumers — callers (e.g. tanstack-start) use the `I18nConfig` methods directly via `getI18nConfig()`. Removing the module trims dead indirection from the `/internal` entry; the `LocaleCandidates` type re-export is unaffected (re-exported from its real source).

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`03bae6d`](https://github.com/generaltranslation/gt/commit/03bae6d3b4791107781cb800c1ae7ac4f675705c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the unused `validateLocales` config validator from `gt-i18n`.

  `validateLocales` was defined but never called (config validation runs `validateLoadTranslations`, `validateTranslationApi`, and `validateDictionary`) and had no consumers anywhere. Dead code removed.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`5d42608`](https://github.com/generaltranslation/gt/commit/5d426089f04f37dd7369620e9db3e6512f06eee8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove deprecated methods from `gt-i18n`'s `I18nCache`.

  Dropped the long-`@deprecated` cache methods that duplicated `I18nConfig`/loader APIs: `getDefaultLocale`, `getLocales`, `getCustomMapping`, `getGTClass`, `getTranslationLoader`, `resolveTranslationSync`, `getTranslations`, and `getTranslationResolver`. None were called anywhere (consumers use `getI18nConfig()` / `lookupTranslation` / `loadTranslations`). Removes the methods, their now-unused imports, and the tests that covered them.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`9804aa4`](https://github.com/generaltranslation/gt/commit/9804aa460c07ec36d2e667d79a839720a1e011e8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove three orphaned, never-imported files:
  - `gt-tanstack-start`: `condition-store/WritableConditionStore.ts` (an orphaned local copy; the package uses gt-i18n's writable condition store).
  - `gt-react-native`: `utils/utils.ts` (`readAuthFromEnv`, no consumers).
  - `gt-i18n`: `i18n-cache/translations-manager/utils/types/translations-manager.ts` (unreferenced `TranslationsManagerConfig` type).

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`2ca78ec`](https://github.com/generaltranslation/gt/commit/2ca78ec4805639c10c7b200c8dee660b55eddf15) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Read Vite runtime credentials during React initialization while keeping dev API keys out of production bundles.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized

- Updated dependencies [[`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0)]:
  - generaltranslation@9.0.0
  - @generaltranslation/format@0.1.2
  - @generaltranslation/supported-locales@2.1.2

## 1.0.0-odysseus.9

### Major Changes

- 463a8db: Add a config-aware `resolveCanonicalLocale` helper and remove the public `getGTClass` helper.
- 1f53e42: Clean up the `gt-i18n` public API surface by removing dead subpaths, internal exports, and unused types.

### Patch Changes

- b72c30b: Clean up the `generaltranslation` public API surface for the next major.

  Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.

- bea8233: Statically gate dev hot-reload code paths (tracked resolver invalidation, missing-translation queue, T hot-reload fallbacks, getGT dev preload) behind `process.env.NODE_ENV !== 'production'` so bundlers can drop them from production builds. Behavior is unchanged: the existing runtime `isDevHotReloadEnabled()` check still applies in development.
- Updated dependencies [b72c30b]
- Updated dependencies [d5cf2d3]
  - generaltranslation@9.0.0-odysseus.6
  - @generaltranslation/supported-locales@2.1.2-odysseus.6

## 1.0.0-odysseus.8

### Patch Changes

- 72e9e16: Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.
- 42a440f: Gate duplicate singleton initialization warnings behind `_GENERALTRANSLATION_LOG_LEVEL=DEBUG`.
- c5364f9: Slim the i18n cache event surface by replacing the generic EventEmitter base class with a single cache-miss listener and removing unused cache helper methods.
- 195f009: fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized
- Updated dependencies [72e9e16]
- Updated dependencies [5adeede]
- Updated dependencies [2e85ebd]
  - generaltranslation@9.0.0-odysseus.5
  - @generaltranslation/supported-locales@2.1.2-odysseus.5

## 1.0.0-odysseus.7

### Minor Changes

- 0cd7813: Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.
  - `gt-i18n`: Removed the unused React locale cookie name from the shared GT config type.
  - `@generaltranslation/react-core`: `ReactI18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName`, exposes getters that fall back to the default names, and exports the default storage names from the `pure` entrypoint.
  - `gt-next`: Imports default cookie names from the React Core `pure` entrypoint instead of the removed React Core cookie constants subpath.
  - `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
  - `gt-react-native`: Native condition storage now resolves its store keys from `I18nConfig`, matching `gt-react` behavior.
  - `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.

### Patch Changes

- ab61565: Defer the missing-projectId and missing-translation-loader warnings from I18nCache construction to the first translation loader invocation. Clients of server-rendered apps receive translations via updateTranslations() and never invoke the fallback loader, so they no longer log spurious warnings on initialization. Explicitly disabling translation loading with cacheUrl: null no longer logs at all, and explicitly setting cacheUrl to the default GT CDN URL alongside a projectId is now classified as GT remote loading.

## 1.0.0-odysseus.6

### Patch Changes

- a2b9677: Restore namespace scoping for getTranslations and server useTranslations.
- 41371e0: Read Vite runtime credentials during React initialization while keeping dev API keys out of production bundles.

## 1.0.0-odysseus.5

### Patch Changes

- 432fa49: Use Next.js caching semantics for Cache Components by disabling GT cache expiry and development hot reload runtime translation.

  Async translation and dictionary lookup boundaries now keep synchronous access to the loaded snapshot, so APIs like `getGT` and `getTranslations` can still resolve strings after cache expiry is delegated to Next.js.

  Global singleton setup now preserves the first initialized instance instead of replacing it on later initialization attempts.

- 432fa49: Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

- 933916e: Store the GT services enabled flag on the i18n config singleton.
- 4a5f8e8: Remove unused internal exports and dead utility code.
- 083d306: Remove deprecated i18n cache lifecycle hooks and unused cache events.

  The cache subscription surface now only exposes `translations-cache-miss`, which is used for runtime translation updates. Deprecated lifecycle constructor callbacks and unused locale/dictionary cache hit/miss events have been removed.

## 1.0.0-odysseus.4

### Patch Changes

- 270b821: Remove the unused `condition-store/localeResolver` module from `gt-i18n/internal`.

  `determineSupportedLocale`, `resolveSupportedLocale`, and `createLocaleResolver` were thin wrappers over `getI18nConfig().<method>()`. They had no consumers — callers (e.g. tanstack-start) use the `I18nConfig` methods directly via `getI18nConfig()`. Removing the module trims dead indirection from the `/internal` entry; the `LocaleCandidates` type re-export is unaffected (re-exported from its real source).

- bffaa67: Remove the unused `validateLocales` config validator from `gt-i18n`.

  `validateLocales` was defined but never called (config validation runs `validateLoadTranslations`, `validateTranslationApi`, and `validateDictionary`) and had no consumers anywhere. Dead code removed.

- d602065: Remove deprecated methods from `gt-i18n`'s `I18nCache`.

  Dropped the long-`@deprecated` cache methods that duplicated `I18nConfig`/loader APIs: `getDefaultLocale`, `getLocales`, `getCustomMapping`, `getGTClass`, `getTranslationLoader`, `resolveTranslationSync`, `getTranslations`, and `getTranslationResolver`. None were called anywhere (consumers use `getI18nConfig()` / `lookupTranslation` / `loadTranslations`). Removes the methods, their now-unused imports, and the tests that covered them.

- Updated dependencies [26faa87]
  - generaltranslation@9.0.0-odysseus.4
  - @generaltranslation/supported-locales@2.1.2-odysseus.4

## 1.0.0-odysseus.3

### Patch Changes

- b765174: Remove three orphaned, never-imported files:
  - `gt-tanstack-start`: `condition-store/WritableConditionStore.ts` (an orphaned local copy; the package uses gt-i18n's writable condition store).
  - `gt-react-native`: `utils/utils.ts` (`readAuthFromEnv`, no consumers).
  - `gt-i18n`: `i18n-cache/translations-manager/utils/types/translations-manager.ts` (unreferenced `TranslationsManagerConfig` type).

- Updated dependencies [b1eef00]
  - generaltranslation@9.0.0-odysseus.3
  - @generaltranslation/supported-locales@2.1.2-odysseus.3

## 1.0.0-odysseus.2

### Major Changes

- [#1687](https://github.com/generaltranslation/gt/pull/1687) [`41c938c`](https://github.com/generaltranslation/gt/commit/41c938c0d00f4b76faa7a2805ad0015891e0740e) Thanks [@bgub](https://github.com/bgub)! - Remove deprecated translation options. The `context` dictionary option has been removed in favor of `$context`, and the `$_locales` inline option has been removed in favor of `$locale`.

- [#1690](https://github.com/generaltranslation/gt/pull/1690) [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce) Thanks [@bgub](https://github.com/bgub)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447)]:
  - @generaltranslation/format@0.1.2-odysseus.1
  - generaltranslation@9.0.0-odysseus.2
  - @generaltranslation/supported-locales@2.1.2-odysseus.2

## 1.0.0-odysseus.1

### Patch Changes

- [#1677](https://github.com/generaltranslation/gt/pull/1677) [`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - generaltranslation@9.0.0-odysseus.1
  - @generaltranslation/supported-locales@2.1.2-odysseus.1

## 1.0.0-odysseus.0

### Major Changes

- [#1627](https://github.com/generaltranslation/gt/pull/1627) [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - @generaltranslation/format@0.1.2-odysseus.0
  - @generaltranslation/supported-locales@2.1.2-odysseus.0
  - generaltranslation@9.0.0-odysseus.0

## 0.9.8

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4

## 0.9.7

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - @generaltranslation/supported-locales@2.1.3

## 0.9.6

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - @generaltranslation/supported-locales@2.1.2

## 0.9.5

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - @generaltranslation/supported-locales@2.1.1

## 0.9.4

### Patch Changes

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0

## 0.9.9

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - generaltranslation@8.2.19
  - @generaltranslation/supported-locales@2.1.5

## 0.9.8

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4

## 0.9.7

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - @generaltranslation/supported-locales@2.1.3

## 0.9.6

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - @generaltranslation/supported-locales@2.1.2

## 0.9.5

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - @generaltranslation/supported-locales@2.1.1

## 0.9.4

### Patch Changes

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0

## 0.9.3

### Patch Changes

- [#1419](https://github.com/generaltranslation/gt/pull/1419) [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300) Thanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages and package-local diagnostic formatting.

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15
  - @generaltranslation/supported-locales@2.0.73

## 0.9.2

### Patch Changes

- [#1397](https://github.com/generaltranslation/gt/pull/1397) [`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99) Thanks [@bgub](https://github.com/bgub)! - Extract locale and formatting primitives into the new `@generaltranslation/format` package and update `generaltranslation/core` to re-export the shared helpers.

- [#1409](https://github.com/generaltranslation/gt/pull/1409) [`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136) Thanks [@bgub](https://github.com/bgub)! - Prevent callers from mutating internal translation caches through `getInternalCache()` and start locale cache TTLs after async loads complete.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14
  - @generaltranslation/supported-locales@2.0.72

## 0.9.1

### Patch Changes

- [#1374](https://github.com/generaltranslation/gt/pull/1374) [`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore(gt-i18n): add comment documentation for t.obj()

- [#1380](https://github.com/generaltranslation/gt/pull/1380) [`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Export i18n manager cache-miss event-name constants from `gt-i18n/internal` so downstream packages such as `@generaltranslation/react-core` can consume one shared source of truth.

- [#1375](https://github.com/generaltranslation/gt/pull/1375) [`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix dictionary getTranslations fallback to use loaded translations when a target dictionary entry is missing.

- Updated dependencies [[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - generaltranslation@8.2.13
  - @generaltranslation/supported-locales@2.0.71

## 0.9.0

### Minor Changes

- [#1359](https://github.com/generaltranslation/gt/pull/1359) [`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Enable dictionary-backed getTranslations with t and t.obj, and expose it from gt-node.

### Patch Changes

- [#1354](https://github.com/generaltranslation/gt/pull/1354) [`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary lookup with runtime fallback.

- [#1355](https://github.com/generaltranslation/gt/pull/1355) [`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary cache object get and set primitives.

- [#1358](https://github.com/generaltranslation/gt/pull/1358) [`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary object lookup with runtime fallback.

- [#1356](https://github.com/generaltranslation/gt/pull/1356) [`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary object lookup on the i18n manager.

- [#1357](https://github.com/generaltranslation/gt/pull/1357) [`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add runtime fallback primitives for dictionary object cache misses.

- [#1349](https://github.com/generaltranslation/gt/pull/1349) [`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Return dictionary metadata from dictionary cache lookups.

- [#1351](https://github.com/generaltranslation/gt/pull/1351) [`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add runtime translation fallback for dictionary cache misses.

- Updated dependencies [[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:
  - generaltranslation@8.2.12
  - @generaltranslation/supported-locales@2.0.70

## 0.8.14

### Patch Changes

- [#1328](https://github.com/generaltranslation/gt/pull/1328) [`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary lookup.

- [#1329](https://github.com/generaltranslation/gt/pull/1329) [`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary cache lifecycle events.

- [#1346](https://github.com/generaltranslation/gt/pull/1346) [`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary metadata entry types without applying metadata at lookup time.

## 0.8.13

### Patch Changes

- [#1325](https://github.com/generaltranslation/gt/pull/1325) [`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary cache primitives.

- [#1310](https://github.com/generaltranslation/gt/pull/1310) [`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e) Thanks [@bgub](https://github.com/bgub)! - Fix dialect translation cache keys for fallback and custom alias locales.

- [#1326](https://github.com/generaltranslation/gt/pull/1326) [`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96) Thanks [@bgub](https://github.com/bgub)! - Fix runtime translation metadata for max character limits.

- [#1327](https://github.com/generaltranslation/gt/pull/1327) [`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Wire dictionary loading into the i18n manager.

- [#1311](https://github.com/generaltranslation/gt/pull/1311) [`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24) Thanks [@bgub](https://github.com/bgub)! - Route gt-next cached and runtime translation lookups through I18nManager.

## 0.8.12

### Patch Changes

- [#1308](https://github.com/generaltranslation/gt/pull/1308) [`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6) Thanks [@bgub](https://github.com/bgub)! - Add shared cache expiry, batching, and runtime translation configuration to I18nManager.

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11
  - @generaltranslation/supported-locales@2.0.69

## 0.8.11

### Patch Changes

- [#1296](https://github.com/generaltranslation/gt/pull/1296) [`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401) Thanks [@bgub](https://github.com/bgub)! - Require explicit locales for I18nManager translation/cache operations, move current-locale lookup into higher-level helpers, and keep runtime condition storage in wrapper runtimes.

## 0.8.10

### Patch Changes

- [#1301](https://github.com/generaltranslation/gt/pull/1301) [`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2) Thanks [@bgub](https://github.com/bgub)! - Fix source-locale interpolation for missing translations and resolve custom locale aliases consistently in browser and TanStack Start locale detection.

## 0.8.9

### Patch Changes

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - @generaltranslation/supported-locales@2.0.68

## 0.8.8

### Patch Changes

- [#1278](https://github.com/generaltranslation/gt/pull/1278) [`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8) Thanks [@bgub](https://github.com/bgub)! - Add a `generaltranslation/core` entrypoint for locale and formatting helpers, and update `gt-i18n` to consume it where possible.

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - @generaltranslation/supported-locales@2.0.67

## 0.8.7

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - @generaltranslation/supported-locales@2.0.66

## 0.8.6

### Patch Changes

- [#1262](https://github.com/generaltranslation/gt/pull/1262) [`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor(gt-i18n): move over to subscription system

## 0.8.5

### Patch Changes

- [#1252](https://github.com/generaltranslation/gt/pull/1252) [`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - fix: pass `maxChars` (not `$maxChars`) to `hashSource` so it factors into the hash

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- [#1249](https://github.com/generaltranslation/gt/pull/1249) [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569) Thanks [@bgub](https://github.com/bgub)! - chore: migrate build from Rollup to tsdown

- Updated dependencies [[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - generaltranslation@8.2.7
  - @generaltranslation/supported-locales@2.0.65

## 0.8.4

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - @generaltranslation/supported-locales@2.0.64

## 0.8.3

### Patch Changes

- [#1218](https://github.com/generaltranslation/gt/pull/1218) [`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(react/browser): dev hot reload

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5
  - @generaltranslation/supported-locales@2.0.63

## 0.8.2

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - @generaltranslation/supported-locales@2.0.62

## 0.8.1

### Patch Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3
  - @generaltranslation/supported-locales@2.0.61

## 0.8.0

### Minor Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

## 0.7.10

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - @generaltranslation/supported-locales@2.0.60
  - generaltranslation@8.2.2

## 0.7.9

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - generaltranslation@8.2.1
  - @generaltranslation/supported-locales@2.0.59

## 0.7.8

### Patch Changes

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0
  - @generaltranslation/supported-locales@2.0.58

## 0.7.7

### Patch Changes

- [#1154](https://github.com/generaltranslation/gt/pull/1154) [`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Restore `GTFunctionType` return type to `string`

## 0.7.6

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23
  - @generaltranslation/supported-locales@2.0.57

## 0.7.5

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - @generaltranslation/supported-locales@2.0.56

## 0.7.4

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - @generaltranslation/supported-locales@2.0.55

## 0.7.3

### Patch Changes

- Updated dependencies [[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:
  - @generaltranslation/supported-locales@2.0.54

## 0.7.2

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20
  - @generaltranslation/supported-locales@2.0.53

## 0.7.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - @generaltranslation/supported-locales@2.0.52
  - generaltranslation@8.1.19

## 0.7.0

### Minor Changes

- [#1121](https://github.com/generaltranslation/gt/pull/1121) [`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5) Thanks [@pie575](https://github.com/pie575)! - Added a versionId hook for users to better access what Version their GT translations are on

### Patch Changes

- Updated dependencies [[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - generaltranslation@8.1.18
  - @generaltranslation/supported-locales@2.0.51

## 0.6.2

### Patch Changes

- [#1118](https://github.com/generaltranslation/gt/pull/1118) [`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t macro

## 0.6.1

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17
  - @generaltranslation/supported-locales@2.0.50

## 0.6.0

### Minor Changes

- [#1113](https://github.com/generaltranslation/gt/pull/1113) [`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add string translation function t()

## 0.5.2

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - @generaltranslation/supported-locales@2.0.49

## 0.5.1

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - @generaltranslation/supported-locales@2.0.48

## 0.5.0

### Minor Changes

- [#1090](https://github.com/generaltranslation/gt/pull/1090) [`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add locale utilities

## 0.4.2

### Patch Changes

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14
  - @generaltranslation/supported-locales@2.0.47

## 0.4.1

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13
  - @generaltranslation/supported-locales@2.0.46

## 0.4.0

### Minor Changes

- [#1051](https://github.com/generaltranslation/gt/pull/1051) [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: string list registration

### Patch Changes

- [#1048](https://github.com/generaltranslation/gt/pull/1048) [`065cfaf`](https://github.com/generaltranslation/gt/commit/065cfaf4e6ac220755a9667b58731520d64fef85) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: declareVar support for gt-i18n

## 0.3.12

### Patch Changes

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12
  - @generaltranslation/supported-locales@2.0.45

## 0.3.11

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11
  - @generaltranslation/supported-locales@2.0.44

## 0.3.10

### Patch Changes

- Updated dependencies [[`573287c`](https://github.com/generaltranslation/gt/commit/573287cb6ac3429c8dd276230e7f5bebf9077230)]:
  - @generaltranslation/supported-locales@2.0.43

## 0.3.9

### Patch Changes

- Updated dependencies [[`06104b0`](https://github.com/generaltranslation/gt/commit/06104b075e14b2299490e645ce1d313224aac639)]:
  - @generaltranslation/supported-locales@2.0.42

## 0.3.8

### Patch Changes

- [#1023](https://github.com/generaltranslation/gt/pull/1023) [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: tanstack start i18n support

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5)]:
  - generaltranslation@8.1.10
  - @generaltranslation/supported-locales@2.0.41

## 0.3.7

### Patch Changes

- [#1008](https://github.com/generaltranslation/gt/pull/1008) [`7c0a319`](https://github.com/generaltranslation/gt/commit/7c0a31917215bd77528f9e8f01c29a113f8f25c6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: gt-node translation interface

## 0.3.6

### Patch Changes

- [#989](https://github.com/generaltranslation/gt/pull/989) [`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: set up i18n base

- [#991](https://github.com/generaltranslation/gt/pull/991) [`8b65862`](https://github.com/generaltranslation/gt/commit/8b65862c33ecb62fa0d9b80ec3fba55dbfe04719) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: support for node environments

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df)]:
  - generaltranslation@8.1.9
  - @generaltranslation/supported-locales@2.0.40

## 0.3.5

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8
  - @generaltranslation/supported-locales@2.0.39

## 0.3.4

### Patch Changes

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7
  - @generaltranslation/supported-locales@2.0.38

## 0.3.3

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6
  - @generaltranslation/supported-locales@2.0.37

## 0.3.2

### Patch Changes

- Updated dependencies [[`4def431`](https://github.com/generaltranslation/gt/commit/4def4316c4e9fe0de02d091a2320667a0f86284a)]:
  - @generaltranslation/supported-locales@2.0.36

## 0.3.1

### Patch Changes

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5
  - @generaltranslation/supported-locales@2.0.35

## 0.3.0

### Minor Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

### Patch Changes

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - generaltranslation@8.1.4
  - @generaltranslation/supported-locales@2.0.34

## 0.2.2

### Patch Changes

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3
  - @generaltranslation/supported-locales@2.0.33

## 0.2.1

### Patch Changes

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2
  - @generaltranslation/supported-locales@2.0.32

## 0.2.0

### Minor Changes

- [#859](https://github.com/generaltranslation/gt/pull/859) [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: max char support

### Patch Changes

- Updated dependencies [[`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71)]:
  - generaltranslation@8.1.1
  - @generaltranslation/supported-locales@2.0.31

## 0.1.3

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0
  - @generaltranslation/supported-locales@2.0.30

## 0.1.2

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6
  - @generaltranslation/supported-locales@2.0.29

## 0.1.1

### Patch Changes

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5
  - @generaltranslation/supported-locales@2.0.28

## 0.1.0

### Minor Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

### Patch Changes

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - @generaltranslation/supported-locales@2.0.27
  - generaltranslation@8.0.4

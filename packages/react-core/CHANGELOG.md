# @generaltranslation/react-core

## 11.0.12

## 11.0.11

## 11.0.10

### Patch Changes

- [#1916](https://github.com/generaltranslation/gt/pull/1916) [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify `gt.config.json` types so complete config objects can be spread into compiler plugins and runtime initializers while file settings remain optional.

- Updated dependencies [[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - generaltranslation@9.0.3
  - gt-i18n@1.0.7

## 11.0.9

### Patch Changes

- [#1852](https://github.com/generaltranslation/gt/pull/1852) [`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561) Thanks [@bgub](https://github.com/bgub)! - Move the default cookie-name constants (`defaultLocaleCookieName`, `defaultRegionCookieName`, `defaultEnableI18nCookieName`, `defaultResetLocaleCookieName`) into a dependency-free module. They were co-located with `ReactI18nConfig`, so importing just a cookie name from `@generaltranslation/react-core/pure` could drag the `gt-i18n/internal` runtime (~60KB) into size-constrained bundles like gt-next's edge middleware. The `/pure` entry re-exports them unchanged.

- [#1888](https://github.com/generaltranslation/gt/pull/1888) [`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf) Thanks [@bgub](https://github.com/bgub)! - Share condition setter hooks through react-core instead of duplicating them in the React and React Native packages.

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2
  - gt-i18n@1.0.6

## 11.0.8

### Patch Changes

- Updated dependencies [[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - generaltranslation@9.0.1
  - gt-i18n@1.0.5

## 11.0.7

### Patch Changes

- Updated dependencies [[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a), [`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:
  - gt-i18n@1.0.4

## 11.0.6

### Patch Changes

- Updated dependencies [[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:
  - gt-i18n@1.0.3

## 11.0.5

## 11.0.4

### Patch Changes

- [#1849](https://github.com/generaltranslation/gt/pull/1849) [`d23766c`](https://github.com/generaltranslation/gt/commit/d23766c78a2c1be278d85e896d2521453734a6eb) Thanks [@bgub](https://github.com/bgub)! - Remove duplicated GTProp computation in `writeChildrenAsObjects`. The result of `createGTProp()` was immediately overwritten by an inline copy of the same logic, and because both copies recursed into plural/branch subtrees, each level of `<Plural>`/`<Branch>` nesting doubled the serialization work. Branch subtrees are now serialized once.

- [#1848](https://github.com/generaltranslation/gt/pull/1848) [`1f33d5f`](https://github.com/generaltranslation/gt/commit/1f33d5f76ffc879d2d21aa2508e07e1d3b66c4e3) Thanks [@bgub](https://github.com/bgub)! - Remove unused dependencies: `@generaltranslation/supported-locales` from gt-react, gt-next, gt-i18n, and @generaltranslation/react-core, and `@generaltranslation/format` from gt-react. Nothing in these packages imports them, so this only reduces install weight.

- Updated dependencies [[`006e071`](https://github.com/generaltranslation/gt/commit/006e071bf87ffe80f2d18958ddfa8f18cc2d85d2), [`7fb4a74`](https://github.com/generaltranslation/gt/commit/7fb4a74c52065694a40deafcf4596acc09e17f58), [`1f33d5f`](https://github.com/generaltranslation/gt/commit/1f33d5f76ffc879d2d21aa2508e07e1d3b66c4e3)]:
  - gt-i18n@1.0.2

## 11.0.3

## 11.0.2

## 11.0.1

### Patch Changes

- Updated dependencies [[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:
  - @generaltranslation/supported-locales@2.1.3
  - gt-i18n@1.0.1

## 11.0.0

### Major Changes

- [#1816](https://github.com/generaltranslation/gt/pull/1816) [`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b) Thanks [@bgub](https://github.com/bgub)! - Add a config-aware `resolveCanonicalLocale` helper and remove the public `getGTClass` helper.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

- [#1816](https://github.com/generaltranslation/gt/pull/1816) [`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b) Thanks [@bgub](https://github.com/bgub)! - Remove the deprecated `useGTClass` hook from public entry points.

- [#1821](https://github.com/generaltranslation/gt/pull/1821) [`40db0c5`](https://github.com/generaltranslation/gt/commit/40db0c54a58e82d693d8a16d19fe5071baabecdc) Thanks [@bgub](https://github.com/bgub)! - Remove `useVersionId` from public package entrypoints.

  The `getVersionId` helper remains available from public function entrypoints and `gt-i18n/internal`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`37e0080`](https://github.com/generaltranslation/gt/commit/37e0080b2c072840cf6c0f1c66a8f0f3a54e17e5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add default form and accessibility labels to LocaleSelector.

- [#1815](https://github.com/generaltranslation/gt/pull/1815) [`1212135`](https://github.com/generaltranslation/gt/commit/1212135e4e09ed754756cac2805bc3a139408dc1) Thanks [@bgub](https://github.com/bgub)! - Clean up the `@generaltranslation/react-core` public API surface.
  - `@generaltranslation/react-core`: Removed dead dictionary helper exports and source files, stopped exporting JSX serialization internals from `/pure`, dropped internal singleton/plumbing exports from `/pure`, removed `useShouldTranslate` from `/hooks`, and kept only `internalInitializeGTSRA` for the server-rendered initializer.
  - `gt-react`: Aliases `internalInitializeGTSRA` locally from the RSC entrypoint so the public `initializeGT` export remains unchanged.
  - `gt-next`: Replaced imports of removed react-core legacy types with equivalent local types.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`04f419d`](https://github.com/generaltranslation/gt/commit/04f419d65e69db3eb4adb8ee6299c0ddee153135) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix source interpolation for default-locale string helpers.
  Clarify that `tx()` does not apply ICU formatting by default.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.

- [#1811](https://github.com/generaltranslation/gt/pull/1811) [`bea8233`](https://github.com/generaltranslation/gt/commit/bea8233d8b055980483cb2e226157f6adcbd8c2b) Thanks [@bgub](https://github.com/bgub)! - Statically gate dev hot-reload code paths (tracked resolver invalidation, missing-translation queue, T hot-reload fallbacks, getGT dev preload) behind `process.env.NODE_ENV !== 'production'` so bundlers can drop them from production builds. Behavior is unchanged: the existing runtime `isDevHotReloadEnabled()` check still applies in development.

- [#1812](https://github.com/generaltranslation/gt/pull/1812) [`5736d58`](https://github.com/generaltranslation/gt/commit/5736d585b8285ef56cc6f412799308969ac786c0) Thanks [@bgub](https://github.com/bgub)! - Use production no-op stubs for dev hot-reload hooks so bundlers can drop more dev-only hot-reload code.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`947fe0c`](https://github.com/generaltranslation/gt/commit/947fe0c97a2821a0980cd3e779252ea0078e80f8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix `useVersionId()` throwing and `useLocaleDirection()` requiring a locale argument in the client and server entrypoints.

  `useVersionId()` now returns the current version id (instead of throwing the react-core "not implemented" error), and `useLocaleDirection()` once again accepts an optional locale that defaults to the current locale. The shared implementation now lives in `@generaltranslation/react-core/hooks`, so `gt-react` and `gt-react-native` use the same behavior; the RSC entrypoint keeps its stricter signatures.

- [#1820](https://github.com/generaltranslation/gt/pull/1820) [`1f53e42`](https://github.com/generaltranslation/gt/commit/1f53e420e9a6475f85cf27e1cd0c9c89f4beeb36) Thanks [@bgub](https://github.com/bgub)! - Clean up the `gt-i18n` public API surface by removing dead subpaths, internal exports, and unused types.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`b3bb391`](https://github.com/generaltranslation/gt/commit/b3bb391d33041680e2d62b6a7c9b05662946544f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.
  - `gt-i18n`: Removed the unused React locale cookie name from the shared GT config type.
  - `@generaltranslation/react-core`: `ReactI18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName`, exposes getters that fall back to the default names, and exports the default storage names from the `pure` entrypoint.
  - `gt-next`: Imports default cookie names from the React Core `pure` entrypoint instead of the removed React Core cookie constants subpath.
  - `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
  - `gt-react-native`: Native condition storage now resolves its store keys from `I18nConfig`, matching `gt-react` behavior.
  - `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`44bc998`](https://github.com/generaltranslation/gt/commit/44bc998abf813ea4a96ade6c2632e1143034bd45) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger a new Odysseus prerelease after updating the release workflow.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`b7d44dc`](https://github.com/generaltranslation/gt/commit/b7d44dc2d79ac3332a0ed55da0ba130b6896f756) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Share render pipeline child renderers with prepared translation rendering.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`9561761`](https://github.com/generaltranslation/gt/commit/9561761c3ab72a5e39327415b3274eccc63f4ffe) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Build `@generaltranslation/react-core` as unbundled, tree-shakeable modules.

  Each entrypoint (`pure`, `hooks`, `components`, `components-rsc`, `cookies`) was previously emitted as a single pre-bundled, minified file, so a consumer importing one component pulled the entire entry. The package now builds unbundled (per-module) output in both ESM and CJS: entrypoints are thin re-export barrels over granular sibling modules, allowing a downstream bundler to drop unused components and hooks.

  The build also stops inlining `generaltranslation`/`@generaltranslation/format` into react-core's output, so they resolve to their single shared copy instead of being duplicated in react-core (they are already loaded standalone). This removes the duplication and keeps the per-module declarations referencing the dependency packages directly, so inferred types stay portable for downstream packages.

  When consumed via ESM (see the companion `gt-next` ESM change), tree-shaking plus de-duplication cuts react-core's client footprint substantially. Output filenames change from `*.cjs.min.cjs`/`*.esm.min.mjs` to `*.cjs`/`*.mjs` (resolved through the `exports` map, so no consumer-facing API change). The package-shape test is updated to assert the new unbundled layout.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`72c6a85`](https://github.com/generaltranslation/gt/commit/72c6a85cc3ca025ebdeb006dbdd865e935ec77ae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add portable selector hook return types for React Native declarations.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`3d95277`](https://github.com/generaltranslation/gt/commit/3d95277a057b28fffc73b3fa616210bdcb447e85) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove unused internal exports and dead utility code.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default exports from package entrypoints and internal source modules.

  Use named imports for affected public entrypoints, including `import { plugin } from 'gt-react-native/plugin'`. The `gt-next/link` entrypoint keeps its default export to match `next/link`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`85a0c19`](https://github.com/generaltranslation/gt/commit/85a0c1998a6500233affd8c1987551170584c782) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the deprecated `internalInitializeGTSPA` export from `@generaltranslation/react-core/pure` and the downstream `gt-react` server/types surfaces. Use `initializeGTSPA` from `gt-react` for browser SPA initialization.

- [#1825](https://github.com/generaltranslation/gt/pull/1825) [`e343775`](https://github.com/generaltranslation/gt/commit/e343775d8a41ce3eea03dd319b90497a9744cc4f) Thanks [@bgub](https://github.com/bgub)! - Remove the accidental `useShouldTranslate` export from `@generaltranslation/react-core/hooks`. The hook is an internal implementation detail and was never meant to be public.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`2c46baf`](https://github.com/generaltranslation/gt/commit/2c46baf137400613495e3fe2865865b5506edece) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Persist TanStack Start locale resolution through the browser locale cookie.
  Allow React i18n config checks to work across bundled react-core entrypoints.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`9e78cf0`](https://github.com/generaltranslation/gt/commit/9e78cf07db58bfe6063bcd0b217553176c9681bd) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Share tracked lookup subscription handling across resolver hooks.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`338e5e8`](https://github.com/generaltranslation/gt/commit/338e5e8a42354c7d288d9be960ebd1d58adfd402) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the unused dictionary-injection helpers from `@generaltranslation/react-core/pure`.

  `collectUntranslatedEntries`, `injectAndMerge`, `injectEntry`, `injectFallbacks`, `injectHashes`, `injectTranslations`, `getSubtree`, `getSubtreeWithCreation`, and `stripMetadataFromEntries` were a self-referential cluster with no consumers anywhere in the library or its packages. Removing them (and their modules/tests) trims ~415 LOC of dead code from the client-shipped `/pure` entry. The still-used dictionary helpers (`getDictionaryEntry`, `getEntryAndMetadata`, `mergeDictionaries`, `flattenDictionary`, `indexDict`, `isDictionaryEntry`) are unchanged.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8834c51`](https://github.com/generaltranslation/gt/commit/8834c518ac84259706f2b603fd024ad13a9072ee) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove three unused exports from `@generaltranslation/react-core/pure`: `isVariableObject`, `renderSkeleton`, and `reactHasUse`. None had consumers anywhere in the libraries. Trims dead code from the client-shipped `/pure` entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized

- Updated dependencies [[`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b), [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0), [`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`42a440f`](https://github.com/generaltranslation/gt/commit/42a440ff3420bdbdb35ed24f9a5af1c9040eaf66), [`fd22c68`](https://github.com/generaltranslation/gt/commit/fd22c68978af50ce519dc06c7b887d3fa67181ae), [`bea8233`](https://github.com/generaltranslation/gt/commit/bea8233d8b055980483cb2e226157f6adcbd8c2b), [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0), [`04b5064`](https://github.com/generaltranslation/gt/commit/04b50645675abb9e927a82056b249b50f0907fcc), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`328795b`](https://github.com/generaltranslation/gt/commit/328795bf730296658a57b7132bbd1e0bbff2fd62), [`1f53e42`](https://github.com/generaltranslation/gt/commit/1f53e420e9a6475f85cf27e1cd0c9c89f4beeb36), [`b3bb391`](https://github.com/generaltranslation/gt/commit/b3bb391d33041680e2d62b6a7c9b05662946544f), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`3d95277`](https://github.com/generaltranslation/gt/commit/3d95277a057b28fffc73b3fa616210bdcb447e85), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`c1e0a0f`](https://github.com/generaltranslation/gt/commit/c1e0a0f837da440eeed84af10b553dee24bfc936), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793), [`c5364f9`](https://github.com/generaltranslation/gt/commit/c5364f977ffb4b387ad39206e6ed626bbeec56f3), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0), [`d863bcf`](https://github.com/generaltranslation/gt/commit/d863bcf05770c336c98b2b2fae8534c90f00df51), [`11ecf87`](https://github.com/generaltranslation/gt/commit/11ecf876a1221b9dbce9fc0c0f0804101558c8a7), [`03bae6d`](https://github.com/generaltranslation/gt/commit/03bae6d3b4791107781cb800c1ae7ac4f675705c), [`5d42608`](https://github.com/generaltranslation/gt/commit/5d426089f04f37dd7369620e9db3e6512f06eee8), [`9804aa4`](https://github.com/generaltranslation/gt/commit/9804aa460c07ec36d2e667d79a839720a1e011e8), [`2ca78ec`](https://github.com/generaltranslation/gt/commit/2ca78ec4805639c10c7b200c8dee660b55eddf15), [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b)]:
  - gt-i18n@1.0.0
  - generaltranslation@9.0.0
  - @generaltranslation/format@0.1.2
  - @generaltranslation/supported-locales@2.1.2

## 11.0.0-odysseus.16

### Major Changes

- 463a8db: Add a config-aware `resolveCanonicalLocale` helper and remove the public `getGTClass` helper.
- 463a8db: Remove the deprecated `useGTClass` hook from public entry points.
- 40db0c5: Remove `useVersionId` from public package entrypoints.

  The `getVersionId` helper remains available from public function entrypoints and `gt-i18n/internal`.

### Patch Changes

- bea8233: Statically gate dev hot-reload code paths (tracked resolver invalidation, missing-translation queue, T hot-reload fallbacks, getGT dev preload) behind `process.env.NODE_ENV !== 'production'` so bundlers can drop them from production builds. Behavior is unchanged: the existing runtime `isDevHotReloadEnabled()` check still applies in development.
- 5736d58: Use production no-op stubs for dev hot-reload hooks so bundlers can drop more dev-only hot-reload code.
- 1f53e42: Clean up the `gt-i18n` public API surface by removing dead subpaths, internal exports, and unused types.
- e343775: Remove the accidental `useShouldTranslate` export from `@generaltranslation/react-core/hooks`. The hook is an internal implementation detail and was never meant to be public.
- Updated dependencies [463a8db]
- Updated dependencies [b72c30b]
- Updated dependencies [bea8233]
- Updated dependencies [1f53e42]
- Updated dependencies [d5cf2d3]
  - gt-i18n@1.0.0-odysseus.9
  - generaltranslation@9.0.0-odysseus.6
  - @generaltranslation/supported-locales@2.1.2-odysseus.6

## 11.0.0-odysseus.15

### Patch Changes

- 04f419d: Fix source interpolation for default-locale string helpers.
  Clarify that `tx()` does not apply ICU formatting by default.
- 72e9e16: Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.
- 195f009: fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized
- Updated dependencies [72e9e16]
- Updated dependencies [42a440f]
- Updated dependencies [5adeede]
- Updated dependencies [c5364f9]
- Updated dependencies [2e85ebd]
- Updated dependencies [195f009]
  - generaltranslation@9.0.0-odysseus.5
  - gt-i18n@1.0.0-odysseus.8
  - @generaltranslation/supported-locales@2.1.2-odysseus.5

## 11.0.0-odysseus.14

### Patch Changes

- 0cd7813: Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.
  - `gt-i18n`: Removed the unused React locale cookie name from the shared GT config type.
  - `@generaltranslation/react-core`: `ReactI18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName`, exposes getters that fall back to the default names, and exports the default storage names from the `pure` entrypoint.
  - `gt-next`: Imports default cookie names from the React Core `pure` entrypoint instead of the removed React Core cookie constants subpath.
  - `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
  - `gt-react-native`: Native condition storage now resolves its store keys from `I18nConfig`, matching `gt-react` behavior.
  - `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.

- Updated dependencies [ab61565]
- Updated dependencies [0cd7813]
  - gt-i18n@1.0.0-odysseus.7

## 11.0.0-odysseus.13

### Patch Changes

- Updated dependencies [a2b9677]
- Updated dependencies [41371e0]
  - gt-i18n@1.0.0-odysseus.6

## 11.0.0-odysseus.12

### Patch Changes

- 7be23bc: Share tracked lookup subscription handling across resolver hooks.

## 11.0.0-odysseus.11

## 11.0.0-odysseus.10

### Patch Changes

- bcba6fd: Fix `useVersionId()` throwing and `useLocaleDirection()` requiring a locale argument in the client and server entrypoints.

  `useVersionId()` now returns the current version id (instead of throwing the react-core "not implemented" error), and `useLocaleDirection()` once again accepts an optional locale that defaults to the current locale. The shared implementation now lives in `@generaltranslation/react-core/hooks`, so `gt-react` and `gt-react-native` use the same behavior; the RSC entrypoint keeps its stricter signatures.

- b7b3eaf: Share render pipeline child renderers with prepared translation rendering.
- dfb5fc9: Add portable selector hook return types for React Native declarations.
- 4a5f8e8: Remove unused internal exports and dead utility code.
- 288c9f8: Remove the deprecated `internalInitializeGTSPA` export from `@generaltranslation/react-core/pure` and the downstream `gt-react` server/types surfaces. Use `initializeGTSPA` from `gt-react` for browser SPA initialization.
- Updated dependencies [432fa49]
- Updated dependencies [432fa49]
- Updated dependencies [933916e]
- Updated dependencies [4a5f8e8]
- Updated dependencies [083d306]
  - gt-i18n@1.0.0-odysseus.5

## 11.0.0-odysseus.9

## 11.0.0-odysseus.8

### Patch Changes

- 6da26e8: Remove three unused exports from `@generaltranslation/react-core/pure`: `isVariableObject`, `renderSkeleton`, and `reactHasUse`. None had consumers anywhere in the libraries. Trims dead code from the client-shipped `/pure` entry.
- Updated dependencies [26faa87]
- Updated dependencies [270b821]
- Updated dependencies [bffaa67]
- Updated dependencies [d602065]
  - generaltranslation@9.0.0-odysseus.4
  - gt-i18n@1.0.0-odysseus.4
  - @generaltranslation/supported-locales@2.1.2-odysseus.4

## 11.0.0-odysseus.7

### Patch Changes

- 07bfb00: Remove the unused dictionary-injection helpers from `@generaltranslation/react-core/pure`.

  `collectUntranslatedEntries`, `injectAndMerge`, `injectEntry`, `injectFallbacks`, `injectHashes`, `injectTranslations`, `getSubtree`, `getSubtreeWithCreation`, and `stripMetadataFromEntries` were a self-referential cluster with no consumers anywhere in the library or its packages. Removing them (and their modules/tests) trims ~415 LOC of dead code from the client-shipped `/pure` entry. The still-used dictionary helpers (`getDictionaryEntry`, `getEntryAndMetadata`, `mergeDictionaries`, `flattenDictionary`, `indexDict`, `isDictionaryEntry`) are unchanged.

- Updated dependencies [b1eef00]
- Updated dependencies [b765174]
  - generaltranslation@9.0.0-odysseus.3
  - gt-i18n@1.0.0-odysseus.3
  - @generaltranslation/supported-locales@2.1.2-odysseus.3

## 11.0.0-odysseus.6

### Patch Changes

- c1aa794: Trigger a new Odysseus prerelease after updating the release workflow.
- e0ace5b: Build `@generaltranslation/react-core` as unbundled, tree-shakeable modules.

  Each entrypoint (`pure`, `hooks`, `components`, `components-rsc`, `cookies`) was previously emitted as a single pre-bundled, minified file, so a consumer importing one component pulled the entire entry. The package now builds unbundled (per-module) output in both ESM and CJS: entrypoints are thin re-export barrels over granular sibling modules, allowing a downstream bundler to drop unused components and hooks.

  The build also stops inlining `generaltranslation`/`@generaltranslation/format` into react-core's output, so they resolve to their single shared copy instead of being duplicated in react-core (they are already loaded standalone). This removes the duplication and keeps the per-module declarations referencing the dependency packages directly, so inferred types stay portable for downstream packages.

  When consumed via ESM (see the companion `gt-next` ESM change), tree-shaking plus de-duplication cuts react-core's client footprint substantially. Output filenames change from `*.cjs.min.cjs`/`*.esm.min.mjs` to `*.cjs`/`*.mjs` (resolved through the `exports` map, so no consumer-facing API change). The package-shape test is updated to assert the new unbundled layout.

## 11.0.0-odysseus.5

### Major Changes

- [#1690](https://github.com/generaltranslation/gt/pull/1690) [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce) Thanks [@bgub](https://github.com/bgub)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- [#1676](https://github.com/generaltranslation/gt/pull/1676) [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default exports from package entrypoints and internal source modules.

  Use named imports for affected public entrypoints, including `import { plugin } from 'gt-react-native/plugin'`. The `gt-next/link` entrypoint keeps its default export to match `next/link`.

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447), [`41c938c`](https://github.com/generaltranslation/gt/commit/41c938c0d00f4b76faa7a2805ad0015891e0740e), [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce)]:
  - @generaltranslation/format@0.1.2-odysseus.1
  - generaltranslation@9.0.0-odysseus.2
  - gt-i18n@1.0.0-odysseus.2
  - @generaltranslation/supported-locales@2.1.2-odysseus.2

## 11.0.0-odysseus.4

### Patch Changes

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - generaltranslation@9.0.0-odysseus.1
  - gt-i18n@1.0.0-odysseus.1
  - @generaltranslation/supported-locales@2.1.2-odysseus.1

## 2.0.0-odysseus.1

### Patch Changes

- [#1657](https://github.com/generaltranslation/gt/pull/1657) [`e29cd01`](https://github.com/generaltranslation/gt/commit/e29cd01c1bfe9ffba64c8fb3794d053a8c1304af) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Persist TanStack Start locale resolution through the browser locale cookie.
  Allow React i18n config checks to work across bundled react-core entrypoints.

## 2.0.0-odysseus.0

### Major Changes

- [#1627](https://github.com/generaltranslation/gt/pull/1627) [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`33203b1`](https://github.com/generaltranslation/gt/commit/33203b1953727647f61a21136b4c9570efbc8620) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add default form and accessibility labels to LocaleSelector.

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - @generaltranslation/format@0.1.2-odysseus.0
  - @generaltranslation/supported-locales@2.1.2-odysseus.0
  - generaltranslation@9.0.0-odysseus.0
  - gt-i18n@1.0.0-odysseus.0

## 1.8.24

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4
  - gt-i18n@0.9.8

## 1.8.23

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - gt-i18n@0.9.7
  - @generaltranslation/supported-locales@2.1.3

## 1.8.22

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - gt-i18n@0.9.6
  - @generaltranslation/supported-locales@2.1.2

## 1.8.21

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - gt-i18n@0.9.5
  - @generaltranslation/supported-locales@2.1.1

## 1.8.20

### Patch Changes

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0
  - gt-i18n@0.9.4

## 1.8.25

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - generaltranslation@8.2.19
  - gt-i18n@0.9.9
  - @generaltranslation/supported-locales@2.1.5

## 1.8.24

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4
  - gt-i18n@0.9.8

## 1.8.23

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - gt-i18n@0.9.7
  - @generaltranslation/supported-locales@2.1.3

## 1.8.22

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - gt-i18n@0.9.6
  - @generaltranslation/supported-locales@2.1.2

## 1.8.21

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - gt-i18n@0.9.5
  - @generaltranslation/supported-locales@2.1.1

## 1.8.20

### Patch Changes

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0
  - gt-i18n@0.9.4

## 1.8.19

### Patch Changes

- [#1419](https://github.com/generaltranslation/gt/pull/1419) [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300) Thanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages and package-local diagnostic formatting.

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15
  - gt-i18n@0.9.3
  - @generaltranslation/supported-locales@2.0.73

## 1.8.18

### Patch Changes

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- [#1415](https://github.com/generaltranslation/gt/pull/1415) [`6e6c69e`](https://github.com/generaltranslation/gt/commit/6e6c69e3ca2f51937407674cf101b69e968952a1) Thanks [@bgub](https://github.com/bgub)! - Switch the React Core package build pipeline to tsdown while preserving the existing public entrypoints.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6), [`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14
  - gt-i18n@0.9.2
  - @generaltranslation/supported-locales@2.0.72

## 1.8.17

### Patch Changes

- Updated dependencies [[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9), [`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e), [`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - gt-i18n@0.9.1
  - generaltranslation@8.2.13
  - @generaltranslation/supported-locales@2.0.71

## 1.8.16

### Patch Changes

- [#1364](https://github.com/generaltranslation/gt/pull/1364) [`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0) Thanks [@pie575](https://github.com/pie575)! - Update Derive docs comments

- Updated dependencies [[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add), [`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016), [`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95), [`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f), [`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2), [`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0), [`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0), [`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a), [`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:
  - gt-i18n@0.9.0
  - generaltranslation@8.2.12
  - @generaltranslation/supported-locales@2.0.70

## 1.8.15

### Patch Changes

- Updated dependencies [[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861), [`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4), [`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:
  - gt-i18n@0.8.14

## 1.8.14

### Patch Changes

- Updated dependencies [[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8), [`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e), [`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96), [`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda), [`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:
  - gt-i18n@0.8.13

## 1.8.13

### Patch Changes

- [#1312](https://github.com/generaltranslation/gt/pull/1312) [`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050) Thanks [@bgub](https://github.com/bgub)! - Fix locale selector sorting so it does not mutate provider locale state.

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11
  - gt-i18n@0.8.12
  - @generaltranslation/supported-locales@2.0.69

## 1.8.12

### Patch Changes

- Updated dependencies [[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:
  - gt-i18n@0.8.11

## 1.8.11

### Patch Changes

- Updated dependencies [[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:
  - gt-i18n@0.8.10

## 1.8.10

### Patch Changes

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - gt-i18n@0.8.9
  - @generaltranslation/supported-locales@2.0.68

## 1.8.9

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - gt-i18n@0.8.8
  - @generaltranslation/supported-locales@2.0.67

## 1.8.8

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - gt-i18n@0.8.7
  - @generaltranslation/supported-locales@2.0.66

## 1.8.7

### Patch Changes

- Updated dependencies [[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:
  - gt-i18n@0.8.6

## 1.8.6

### Patch Changes

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- Updated dependencies [[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8), [`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - gt-i18n@0.8.5
  - generaltranslation@8.2.7
  - @generaltranslation/supported-locales@2.0.65

## 1.8.5

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - gt-i18n@0.8.4
  - @generaltranslation/supported-locales@2.0.64

## 1.8.4

### Patch Changes

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5
  - gt-i18n@0.8.3
  - @generaltranslation/supported-locales@2.0.63

## 1.8.3

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - gt-i18n@0.8.2
  - @generaltranslation/supported-locales@2.0.62

## 1.8.2

### Patch Changes

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3
  - gt-i18n@0.8.1
  - @generaltranslation/supported-locales@2.0.61

## 1.8.1

### Patch Changes

- [#1202](https://github.com/generaltranslation/gt/pull/1202) [`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: update html langtag for i18n-context

## 1.8.0

### Minor Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

### Patch Changes

- Updated dependencies [[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:
  - gt-i18n@0.8.0

## 1.7.2

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - @generaltranslation/supported-locales@2.0.60
  - generaltranslation@8.2.2
  - gt-i18n@0.7.10

## 1.7.1

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - gt-i18n@0.7.9
  - generaltranslation@8.2.1
  - @generaltranslation/supported-locales@2.0.59

## 1.7.0

### Minor Changes

- [#1153](https://github.com/generaltranslation/gt/pull/1153) [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add `<RelativeTime>` component for localized relative time formatting
  - New `<RelativeTime>` component with two usage modes:
    - Auto-select unit from a Date: `<RelativeTime>{someDate}</RelativeTime>` → "2 hours ago"
    - Explicit value + unit: `<RelativeTime value={-1} unit="day" />` → "yesterday"
  - Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds → minutes → hours → days → weeks → months → years)
  - Core: `formatRelativeTimeFromDate()` standalone function and `GT.formatRelativeTimeFromDate()` class method
  - Week unit included in auto-selection thresholds (7-27 days)
  - CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a variable component

### Patch Changes

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0
  - gt-i18n@0.7.8
  - @generaltranslation/supported-locales@2.0.58

## 1.6.7

### Patch Changes

- Updated dependencies [[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:
  - gt-i18n@0.7.7

## 1.6.6

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23
  - gt-i18n@0.7.6
  - @generaltranslation/supported-locales@2.0.57

## 1.6.5

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - gt-i18n@0.7.5
  - @generaltranslation/supported-locales@2.0.56

## 1.6.4

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - gt-i18n@0.7.4
  - @generaltranslation/supported-locales@2.0.55

## 1.6.3

### Patch Changes

- Updated dependencies [[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:
  - @generaltranslation/supported-locales@2.0.54
  - gt-i18n@0.7.3

## 1.6.2

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20
  - gt-i18n@0.7.2
  - @generaltranslation/supported-locales@2.0.53

## 1.6.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - @generaltranslation/supported-locales@2.0.52
  - generaltranslation@8.1.19
  - gt-i18n@0.7.1

## 1.6.0

### Minor Changes

- [#1121](https://github.com/generaltranslation/gt/pull/1121) [`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5) Thanks [@pie575](https://github.com/pie575)! - Added a versionId hook for users to better access what Version their GT translations are on

### Patch Changes

- Updated dependencies [[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5), [`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - gt-i18n@0.7.0
  - generaltranslation@8.1.18
  - @generaltranslation/supported-locales@2.0.51

## 1.5.10

### Patch Changes

- Updated dependencies [[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:
  - gt-i18n@0.6.2

## 1.5.9

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17
  - gt-i18n@0.6.1
  - @generaltranslation/supported-locales@2.0.50

## 1.5.8

### Patch Changes

- [#1113](https://github.com/generaltranslation/gt/pull/1113) [`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add string translation function t()

- Updated dependencies [[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:
  - gt-i18n@0.6.0

## 1.5.7

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - gt-i18n@0.5.2
  - @generaltranslation/supported-locales@2.0.49

## 1.5.6

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - gt-i18n@0.5.1
  - @generaltranslation/supported-locales@2.0.48

## 1.5.5

### Patch Changes

- Updated dependencies [[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:
  - gt-i18n@0.5.0

## 1.5.4

### Patch Changes

- [#1076](https://github.com/generaltranslation/gt/pull/1076) [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply style guide to error messages and warnings: remove "Please", simplify verbose phrasing, fix `in-line` → `inline`.

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14
  - gt-i18n@0.4.2
  - @generaltranslation/supported-locales@2.0.47

## 1.5.3

### Patch Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

## 1.5.2

### Patch Changes

- [#1068](https://github.com/generaltranslation/gt/pull/1068) [`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: runtime calculation for the injection of 'data-' attribute in jsx

## 1.5.1

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13
  - gt-i18n@0.4.1
  - @generaltranslation/supported-locales@2.0.46

## 1.5.0

### Minor Changes

- [#1051](https://github.com/generaltranslation/gt/pull/1051) [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: string list registration

### Patch Changes

- Updated dependencies [[`065cfaf`](https://github.com/generaltranslation/gt/commit/065cfaf4e6ac220755a9667b58731520d64fef85), [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533)]:
  - gt-i18n@0.4.0

## 1.4.12

### Patch Changes

- [#1046](https://github.com/generaltranslation/gt/pull/1046) [`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d) Thanks [@brian-lou](https://github.com/brian-lou)! - Update /translate endpoint

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12
  - gt-i18n@0.3.12
  - @generaltranslation/supported-locales@2.0.45

## 1.4.11

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11
  - gt-i18n@0.3.11
  - @generaltranslation/supported-locales@2.0.44

## 1.4.10

### Patch Changes

- Updated dependencies [[`573287c`](https://github.com/generaltranslation/gt/commit/573287cb6ac3429c8dd276230e7f5bebf9077230)]:
  - @generaltranslation/supported-locales@2.0.43
  - gt-i18n@0.3.10

## 1.4.9

### Patch Changes

- Updated dependencies [[`06104b0`](https://github.com/generaltranslation/gt/commit/06104b075e14b2299490e645ce1d313224aac639)]:
  - @generaltranslation/supported-locales@2.0.42
  - gt-i18n@0.3.9

## 1.4.8

### Patch Changes

- [#1023](https://github.com/generaltranslation/gt/pull/1023) [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: tanstack start i18n support

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5), [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31)]:
  - generaltranslation@8.1.10
  - gt-i18n@0.3.8
  - @generaltranslation/supported-locales@2.0.41

## 1.4.7

### Patch Changes

- Updated dependencies [[`7c0a319`](https://github.com/generaltranslation/gt/commit/7c0a31917215bd77528f9e8f01c29a113f8f25c6)]:
  - gt-i18n@0.3.7

## 1.4.6

### Patch Changes

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df), [`8b65862`](https://github.com/generaltranslation/gt/commit/8b65862c33ecb62fa0d9b80ec3fba55dbfe04719)]:
  - generaltranslation@8.1.9
  - gt-i18n@0.3.6
  - @generaltranslation/supported-locales@2.0.40

## 1.4.5

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8
  - gt-i18n@0.3.5
  - @generaltranslation/supported-locales@2.0.39

## 1.4.4

### Patch Changes

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7
  - gt-i18n@0.3.4
  - @generaltranslation/supported-locales@2.0.38

## 1.4.3

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6
  - gt-i18n@0.3.3
  - @generaltranslation/supported-locales@2.0.37

## 1.4.2

### Patch Changes

- Updated dependencies [[`4def431`](https://github.com/generaltranslation/gt/commit/4def4316c4e9fe0de02d091a2320667a0f86284a)]:
  - @generaltranslation/supported-locales@2.0.36
  - gt-i18n@0.3.2

## 1.4.1

### Patch Changes

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5
  - gt-i18n@0.3.1
  - @generaltranslation/supported-locales@2.0.35

## 1.4.0

### Minor Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

### Patch Changes

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - gt-i18n@0.3.0
  - generaltranslation@8.1.4
  - @generaltranslation/supported-locales@2.0.34

## 1.3.2

### Patch Changes

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3
  - gt-i18n@0.2.2
  - @generaltranslation/supported-locales@2.0.33

## 1.3.1

### Patch Changes

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2
  - gt-i18n@0.2.1
  - @generaltranslation/supported-locales@2.0.32

## 1.3.0

### Minor Changes

- [#859](https://github.com/generaltranslation/gt/pull/859) [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: max chars

### Patch Changes

- Updated dependencies [[`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab), [`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71)]:
  - gt-i18n@0.2.0
  - generaltranslation@8.1.1
  - @generaltranslation/supported-locales@2.0.31

## 1.2.7

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0
  - gt-i18n@0.1.3
  - @generaltranslation/supported-locales@2.0.30

## 1.2.6

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6
  - gt-i18n@0.1.2
  - @generaltranslation/supported-locales@2.0.29

## 1.2.5

### Patch Changes

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5
  - gt-i18n@0.1.1
  - @generaltranslation/supported-locales@2.0.28

## 1.2.4

### Patch Changes

- [#831](https://github.com/generaltranslation/gt/pull/831) [`73d78b2`](https://github.com/generaltranslation/gt/commit/73d78b20e067fd291080856d33dd1bd2656b3399) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: disable runtime and cache behavior by setting cacheUrl and runtimeUrl to null

## 1.2.3

### Patch Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - gt-i18n@0.1.0
  - @generaltranslation/supported-locales@2.0.27
  - generaltranslation@8.0.4

## 1.2.2

### Patch Changes

- Updated dependencies [[`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831)]:
  - generaltranslation@8.0.3
  - @generaltranslation/supported-locales@2.0.26

## 1.2.1

### Patch Changes

- Updated dependencies [[`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915)]:
  - generaltranslation@8.0.2
  - @generaltranslation/supported-locales@2.0.25

## 1.2.0

### Minor Changes

- [#809](https://github.com/generaltranslation/gt/pull/809) [`a287f6f`](https://github.com/generaltranslation/gt/commit/a287f6fc79cc96acdc082fc4ff664bb23d0f0e3c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: enable i18n feature flag for gt-react

## 1.1.1

### Patch Changes

- Updated dependencies [[`f98c504`](https://github.com/generaltranslation/gt/commit/f98c504f1e025024b3e1e5e16a0271e86ed095fa)]:
  - generaltranslation@8.0.1
  - @generaltranslation/supported-locales@2.0.24

## 1.1.0

### Minor Changes

- [#788](https://github.com/generaltranslation/gt/pull/788) [`99e4648`](https://github.com/generaltranslation/gt/commit/99e46486ae2046c689e0045372d63c4eb3dc5d48) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - More information: https://https://generaltranslation.com/en-US/blog/gt-next_v6_8_0

  feat: static component

### Patch Changes

- Updated dependencies [[`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719)]:
  - generaltranslation@8.0.0
  - @generaltranslation/supported-locales@2.0.23

## 1.0.9

### Patch Changes

- Updated dependencies [[`3da05a1`](https://github.com/generaltranslation/gt/commit/3da05a12a37a62ace3c7e321aa2fed5a4af52ad9)]:
  - generaltranslation@7.9.1
  - @generaltranslation/supported-locales@2.0.22

## 1.0.8

### Patch Changes

- Updated dependencies [[`93881f1`](https://github.com/generaltranslation/gt/commit/93881f159455a9bbc13d14e7fec9befa60998ba3)]:
  - generaltranslation@7.9.0
  - @generaltranslation/supported-locales@2.0.21

## 1.0.7

### Patch Changes

- [#782](https://github.com/generaltranslation/gt/pull/782) [`155fc2c`](https://github.com/generaltranslation/gt/commit/155fc2c987078b2ffc12c55abb65bb7ff16eb09b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: only throw errors in development for invalid icu strings

## 1.0.6

### Patch Changes

- Updated dependencies [[`7434c15`](https://github.com/generaltranslation/gt/commit/7434c1503c2a62bdb90d4058f903a56331276365)]:
  - generaltranslation@7.8.0
  - @generaltranslation/supported-locales@2.0.20

## 1.0.5

### Patch Changes

- [#769](https://github.com/generaltranslation/gt/pull/769) [`08dc642`](https://github.com/generaltranslation/gt/commit/08dc642bcbcc46d83b8ee6312200bc64a1fb84e3) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handling of React.use mismatch between 18 and 19

## 1.0.4

### Patch Changes

- [#761](https://github.com/generaltranslation/gt/pull/761) [`1499720`](https://github.com/generaltranslation/gt/commit/149972082ec9ce02953cdbb3290e9a0364e58a33) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - refactor: msg() function now returns plain text

## 1.0.3

### Patch Changes

- Updated dependencies [[`7ba2e84`](https://github.com/generaltranslation/gt/commit/7ba2e8412b608aa3415f4865dc26adbbd3daa236)]:
  - generaltranslation@7.7.3
  - @generaltranslation/supported-locales@2.0.19

## 1.0.2

### Patch Changes

- Updated dependencies [[`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701)]:
  - generaltranslation@7.7.2
  - @generaltranslation/supported-locales@2.0.18

## 1.0.1

### Patch Changes

- Updated dependencies [[`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a)]:
  - generaltranslation@7.7.1
  - @generaltranslation/supported-locales@2.0.17

## 1.0.0

### Major Changes

- [#746](https://github.com/generaltranslation/gt/pull/746) [`83a5b26`](https://github.com/generaltranslation/gt/commit/83a5b26cc70f9a7378bbcafbf6c035462598fc8a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: modularize gt-react package

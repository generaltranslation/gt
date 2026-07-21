# gt-next

## 11.0.11

### Patch Changes

- [#1928](https://github.com/generaltranslation/gt/pull/1928) [`84bc362`](https://github.com/generaltranslation/gt/commit/84bc362d03d03c6f70773c35e6d92770ad56548f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Use the client-safe React i18n cache in the browser so gt-next only resolves dictionary files and loaders on the server.

- Updated dependencies []:
  - @generaltranslation/react-core@11.0.11
  - gt-react@11.0.11

## 11.0.10

### Patch Changes

- [#1921](https://github.com/generaltranslation/gt/pull/1921) [`50043dd`](https://github.com/generaltranslation/gt/commit/50043dd68387d6db52afa6f09c74d9c9fa4d2d5f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Support automatic JSX injection with the webpack compiler and import the injected components from `gt-next`.

- Updated dependencies [[`dce7a7a`](https://github.com/generaltranslation/gt/commit/dce7a7a0b5b82ee0ac7ca3518030ab51026da103), [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - @generaltranslation/compiler@1.3.32
  - generaltranslation@9.0.3
  - gt-i18n@1.0.7
  - @generaltranslation/react-core@11.0.10
  - gt-react@11.0.10

## 11.0.9

### Patch Changes

- [#1894](https://github.com/generaltranslation/gt/pull/1894) [`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Correct the shipped `CompilerOptions.type` documentation to show `none` as the runtime default.

- [#1850](https://github.com/generaltranslation/gt/pull/1850) [`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288) Thanks [@bgub](https://github.com/bgub)! - Stop publishing unreachable `index.types` runtime bundles. The `index.types` entry only backs the exports map's `types` conditions, so only its declaration files are ever resolved; the runtime `.cjs`/`.mjs` artifacts (and sourcemaps) were dead weight in the published package (~179KB in gt-react, ~83KB in gt-next). They are now deleted after each build.

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288), [`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561), [`da32fa0`](https://github.com/generaltranslation/gt/commit/da32fa05bd718fc55ce418e68678c2d2691d5433), [`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2
  - gt-react@11.0.9
  - @generaltranslation/react-core@11.0.9
  - @generaltranslation/compiler@1.3.31
  - gt-i18n@1.0.6

## 11.0.8

### Patch Changes

- [#1881](https://github.com/generaltranslation/gt/pull/1881) [`4ea53d6`](https://github.com/generaltranslation/gt/commit/4ea53d68e0889784d5255c9fc254b79950caace0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Exclude custom translation IDs from SWC-generated content hashes to match the TypeScript compiler and runtime.

- Updated dependencies [[`7f0fbfe`](https://github.com/generaltranslation/gt/commit/7f0fbfef78f677372d39087252ab8d6c72d78e7e), [`ed53c71`](https://github.com/generaltranslation/gt/commit/ed53c71bc5c6a8d82feaef1b52f68d20b3794c0b), [`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - @generaltranslation/compiler@1.3.30
  - generaltranslation@9.0.1
  - gt-i18n@1.0.5
  - gt-react@11.0.8
  - @generaltranslation/react-core@11.0.8

## 11.0.7

### Patch Changes

- Updated dependencies [[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a), [`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:
  - gt-i18n@1.0.4
  - gt-react@11.0.7
  - @generaltranslation/react-core@11.0.7

## 11.0.6

### Patch Changes

- [#1873](https://github.com/generaltranslation/gt/pull/1873) [`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger package publication after repairing release workspace dependency resolution.

- Updated dependencies [[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1), [`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:
  - @generaltranslation/compiler@1.3.29
  - gt-i18n@1.0.3
  - gt-react@11.0.6
  - @generaltranslation/react-core@11.0.6

## 11.0.5

### Patch Changes

- Updated dependencies [[`cb8f38e`](https://github.com/generaltranslation/gt/commit/cb8f38ebe5e9c7336bb4820dbef4b6ee5675645d), [`53e61ab`](https://github.com/generaltranslation/gt/commit/53e61abbb4522631f252bcd268eae9c079dd9967)]:
  - @generaltranslation/compiler@1.3.28
  - @generaltranslation/react-core@11.0.5
  - gt-react@11.0.5

## 11.0.4

### Patch Changes

- [#1847](https://github.com/generaltranslation/gt/pull/1847) [`d8938b6`](https://github.com/generaltranslation/gt/commit/d8938b68ed8247b304d0cc0c22db3d3cc3a0b2ac) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add `withGTStaticProps()` for hydrating each statically generated Pages Router locale with its relevant translation snapshot. Pages Router locale routing is required so Next.js generates the page once per locale.

- [#1848](https://github.com/generaltranslation/gt/pull/1848) [`1f33d5f`](https://github.com/generaltranslation/gt/commit/1f33d5f76ffc879d2d21aa2508e07e1d3b66c4e3) Thanks [@bgub](https://github.com/bgub)! - Remove unused dependencies: `@generaltranslation/supported-locales` from gt-react, gt-next, gt-i18n, and @generaltranslation/react-core, and `@generaltranslation/format` from gt-react. Nothing in these packages imports them, so this only reduces install weight.

- [#1851](https://github.com/generaltranslation/gt/pull/1851) [`604889b`](https://github.com/generaltranslation/gt/commit/604889bf0cb833ecafbbe2febae842c81e161d10) Thanks [@bgub](https://github.com/bgub)! - Make `@generaltranslation/compiler` an optional peer dependency instead of a hard dependency. It is only used by the experimental `experimentalCompilerOptions.type: 'babel'` webpack path, which already degrades gracefully with a warning when the package cannot be resolved. Users who enable the experimental babel compiler must now install `@generaltranslation/compiler` themselves; everyone else saves ~8.5MB of install weight (the compiler plus its Babel toolchain).

- Updated dependencies [[`006e071`](https://github.com/generaltranslation/gt/commit/006e071bf87ffe80f2d18958ddfa8f18cc2d85d2), [`7fb4a74`](https://github.com/generaltranslation/gt/commit/7fb4a74c52065694a40deafcf4596acc09e17f58), [`d23766c`](https://github.com/generaltranslation/gt/commit/d23766c78a2c1be278d85e896d2521453734a6eb), [`1f33d5f`](https://github.com/generaltranslation/gt/commit/1f33d5f76ffc879d2d21aa2508e07e1d3b66c4e3)]:
  - @generaltranslation/compiler@1.3.26
  - gt-i18n@1.0.2
  - gt-react@11.0.4
  - @generaltranslation/react-core@11.0.4

## 11.0.3

### Patch Changes

- [#1844](https://github.com/generaltranslation/gt/pull/1844) [`d5a705f`](https://github.com/generaltranslation/gt/commit/d5a705f44991e3eb55a1ee803cfa816b53194a02) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Move middleware path filtering to `withGTConfig` and apply it to client-side locale path checks.

- Updated dependencies []:
  - @generaltranslation/react-core@11.0.3
  - gt-react@11.0.3

## 11.0.2

### Patch Changes

- [#1841](https://github.com/generaltranslation/gt/pull/1841) [`ae7eb72`](https://github.com/generaltranslation/gt/commit/ae7eb72ec46ad72fb693521faddc03d4950a3973) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a `regexFilter` option to `createNextMiddleware` for limiting i18n middleware routing to matching pathnames.

- Updated dependencies []:
  - @generaltranslation/react-core@11.0.2
  - gt-react@11.0.2

## 11.0.1

### Patch Changes

- Updated dependencies [[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:
  - @generaltranslation/supported-locales@2.1.3
  - gt-i18n@1.0.1
  - gt-react@11.0.1
  - @generaltranslation/react-core@11.0.1

## 11.0.0

### Major Changes

- [#1816](https://github.com/generaltranslation/gt/pull/1816) [`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b) Thanks [@bgub](https://github.com/bgub)! - Add a config-aware `resolveCanonicalLocale` helper and remove the public `getGTClass` helper.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

- [#1816](https://github.com/generaltranslation/gt/pull/1816) [`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b) Thanks [@bgub](https://github.com/bgub)! - Remove the deprecated `useGTClass` hook from public entry points.

- [#1821](https://github.com/generaltranslation/gt/pull/1821) [`40db0c5`](https://github.com/generaltranslation/gt/commit/40db0c54a58e82d693d8a16d19fe5071baabecdc) Thanks [@bgub](https://github.com/bgub)! - Remove `useVersionId` from public package entrypoints.

  The `getVersionId` helper remains available from public function entrypoints and `gt-i18n/internal`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Use Next.js caching semantics for Cache Components by disabling GT cache expiry and development hot reload runtime translation.

  Async translation and dictionary lookup boundaries now keep synchronous access to the loaded snapshot, so APIs like `getGT` and `getTranslations` can still resolve strings after cache expiry is delegated to Next.js.

  Global singleton setup now preserves the first initialized instance instead of replacing it on later initialization attempts.

- [#1824](https://github.com/generaltranslation/gt/pull/1824) [`1a483ae`](https://github.com/generaltranslation/gt/commit/1a483aee3e8d8dff8ee1052da089e494965ad350) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove deprecated Next internal packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`7a9dbe3`](https://github.com/generaltranslation/gt/commit/7a9dbe3c188787a39ee1de78f54c92dff470b502) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Clean up stale package metadata and align TanStack Start package entry points.

- [#1815](https://github.com/generaltranslation/gt/pull/1815) [`1212135`](https://github.com/generaltranslation/gt/commit/1212135e4e09ed754756cac2805bc3a139408dc1) Thanks [@bgub](https://github.com/bgub)! - Clean up the `@generaltranslation/react-core` public API surface.
  - `@generaltranslation/react-core`: Removed dead dictionary helper exports and source files, stopped exporting JSX serialization internals from `/pure`, dropped internal singleton/plumbing exports from `/pure`, removed `useShouldTranslate` from `/hooks`, and kept only `internalInitializeGTSRA` for the server-rendered initializer.
  - `gt-react`: Aliases `internalInitializeGTSRA` locally from the RSC entrypoint so the public `initializeGT` export remains unchanged.
  - `gt-next`: Replaced imports of removed react-core legacy types with equivalent local types.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`04f419d`](https://github.com/generaltranslation/gt/commit/04f419d65e69db3eb4adb8ee6299c0ddee153135) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix source interpolation for default-locale string helpers.
  Clarify that `tx()` does not apply ICU formatting by default.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`bd52e5e`](https://github.com/generaltranslation/gt/commit/bd52e5ef3fb38a63d9bac8a4af08ff93402c0749) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow client i18n cache expiry to default to no expiry while preserving explicit cache expiry configuration.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`98698de`](https://github.com/generaltranslation/gt/commit/98698de8da1f60baab3dc218c75c87cc172a24bf) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Escape backslashes in middleware path regex input before dynamic path matching.

- [#1659](https://github.com/generaltranslation/gt/pull/1659) [`807dc30`](https://github.com/generaltranslation/gt/commit/807dc305c4b5e4ce8f6982d96886a530910f3f37) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a locale-aware Link component for Next.js applications.

  Transpile gt-next in Next apps so package runtime config is compiled with app env values. See #1661.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8d2e84e`](https://github.com/generaltranslation/gt/commit/8d2e84e5083bb740815004bec90eaa341be7aff5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Preserve enableI18n hydration state from server props and request cookies.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`361e158`](https://github.com/generaltranslation/gt/commit/361e158626c39fb79132ec31315bbfae9c525305) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Stop forwarding `locale={false}` from `gt-next/link` to the underlying Next.js link after localizing the href.

  This avoids React DOM warnings in newer Next.js versions where the control prop can reach the rendered anchor.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`04b5064`](https://github.com/generaltranslation/gt/commit/04b50645675abb9e927a82056b249b50f0907fcc) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Restore namespace scoping for getTranslations and server useTranslations.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`ca7218e`](https://github.com/generaltranslation/gt/commit/ca7218e0e509d84d874ce4ec622a0dbea7a2ae52) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Ship a dual ESM/CJS build for `gt-next` and add `import` export conditions.

  Previously `gt-next` was published as CJS only (no `import` condition), so bundlers resolved the entire gt dependency graph (`gt-react`, `@generaltranslation/react-core`, `generaltranslation`, `gt-i18n`, `@generaltranslation/format`) through the `require` condition. That forced CJS variants onto the client, which cannot be tree-shaken — shipping `gt-next`'s own server/error code and unused dependency exports to the browser.

  `gt-next` now emits unbundled `.mjs` output alongside the existing `.js` output, and every `exports` subpath exposes an `import` condition. Bundlers now resolve the gt graph as ESM, enabling tree-shaking across all gt packages. Measured on a real Next.js app, this cuts gt's total client bundle by ~19% gzip (≈96 kB → ≈78 kB) with no API changes.

  The ESM build sets `polyfillRequire: false` so rolldown does not inject a package-wide `createRequire`-from-`node:module` shim, keeps custom request function imports visible to bundler aliases, and marks the `index.rsc`/`index.client` entrypoints as having side effects so their top-level initialization is not tree-shaken away.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`1f10252`](https://github.com/generaltranslation/gt/commit/1f1025268c24472b03402e9dcb5626ca6f618b46) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Point the `react-server` export condition at the RSC-specific declaration file so TypeScript no longer exposes client-only hooks in React Server Components.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`b3bb391`](https://github.com/generaltranslation/gt/commit/b3bb391d33041680e2d62b6a7c9b05662946544f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.
  - `gt-i18n`: Removed the unused React locale cookie name from the shared GT config type.
  - `@generaltranslation/react-core`: `ReactI18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName`, exposes getters that fall back to the default names, and exports the default storage names from the `pure` entrypoint.
  - `gt-next`: Imports default cookie names from the React Core `pure` entrypoint instead of the removed React Core cookie constants subpath.
  - `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
  - `gt-react-native`: Native condition storage now resolves its store keys from `I18nConfig`, matching `gt-react` behavior.
  - `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`0a6a11c`](https://github.com/generaltranslation/gt/commit/0a6a11c07adb409c844e7bf85fa56d265cb556cd) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Keep the locale cookie when the middleware clears the setLocale reset cookie. Deleting it raced with concurrent prefetch responses after a locale switch in production builds, causing client components to fall back to the browser's default locale while server components rendered the selected locale.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`cecb3e1`](https://github.com/generaltranslation/gt/commit/cecb3e1f0c9d15c4d5fde6a43a007884e8dac11e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Delegate remote translation loading to the shared i18n cache and only pass custom Next.js translation loaders when configured.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`294791a`](https://github.com/generaltranslation/gt/commit/294791a931f35143524ce685777bb9485fac099e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a Pages Router server-side props helper for GT locale and translation snapshots.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default exports from package entrypoints and internal source modules.

  Use named imports for affected public entrypoints, including `import { plugin } from 'gt-react-native/plugin'`. The `gt-next/link` entrypoint keeps its default export to match `next/link`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`ee688b2`](https://github.com/generaltranslation/gt/commit/ee688b2259451f4fc56d24d0a398d8f001eabfa2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Read Next runtime credentials from environment variables and keep them out of serialized config.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`a8876d4`](https://github.com/generaltranslation/gt/commit/a8876d400b3099b5257d391af76df1d9814c7b7a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Initialize gt-next server entrypoints with a shared server condition store.

- [#1822](https://github.com/generaltranslation/gt/pull/1822) [`ce8a665`](https://github.com/generaltranslation/gt/commit/ce8a665fd077ce2acb66c3f81db3bad5a781e9a7) Thanks [@bgub](https://github.com/bgub)! - Clean up the `gt-next` API surface for the next major prerelease.

  Removes the deprecated `initGT` config alias and the redundant `gt-next/types` subpath. Moves the hidden dictionary and loader subpaths under `gt-next/internal/*`, updates the Next config alias plumbing to match, and adjusts CLI setup detection so it no longer treats `initGT` as a valid existing config wrapper.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`384be28`](https://github.com/generaltranslation/gt/commit/384be28f4d6fe924696dc4f30dcb31823f17c254) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove 21 unused error/warning builders from `gt-next`'s `errors/createErrors.ts`.

  The following had no consumers anywhere: `createDictionaryTranslationError`, `createInvalidDictionaryEntryWarning`, `createInvalidDictionaryTranslationEntryWarning`, `createInvalidIcuDictionaryEntryError`, `createInvalidIcuDictionaryEntryWarning`, `createMismatchingHashWarning`, `createNoEntryFoundWarning`, `createRequiredPrefixError`, `createStringRenderError`, `createStringRenderWarning`, `createStringTranslationError`, `createTranslationLoadingWarning`, `dictionaryDisabledError`, `dictionaryNotFoundWarning`, `gtProviderUseClientError`, `missingVariablesError`, `noInitGTWarn`, `runtimeTranslationTimeoutWarning`, `txUseClientError`, `unresolvedGetLocaleBuildError`, `usingDefaultsWarning`. ~155 LOC of dead error-string code removed.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`bd02086`](https://github.com/generaltranslation/gt/commit/bd020860e98977d7cd1b36e310c92c8727e63865) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the unused `getDomain` request-function plumbing from `gt-next`.

  `getDomain` was scaffolded (a throw-only `internal/_getDomain` stub, a `getDomainPath` config prop, a `getDomain` entry in the request-function registry, and a `_GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED` build env var) but never wired to any runtime consumer — no `getDomain()` request helper exists and nothing reads the env var. Removes the stub module, the `./internal/_getDomain` export, the config prop/registry entries, and the dead env var. `getLocale`/`getRegion` are unchanged.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d6ffb70`](https://github.com/generaltranslation/gt/commit/d6ffb7094d46294de2f61acfba9b4c6cb044b0db) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the deprecated SSG and experimental-locale-resolution code paths from `gt-next`.

  Drops the long-deprecated, runtime-dead config surface: `experimentalEnableSSG`, `experimentalLocaleResolution`/`experimentalLocaleResolutionParam`, the static request functions (`STATIC_REQUEST_FUNCTIONS`/`getStatic*` and their non-existent `internal/static/*` aliases), and `disableSSGWarnings`/`getStatic*Path` doc props. Removes `plugin/checks/ssgChecks.ts`, the experimental branch of `cacheComponentsChecks`, the related error/warning builders, and the corresponding build-time env vars (`_GENERALTRANSLATION_ENABLE_SSG`, `_GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION[_PARAM]`, `_GENERALTRANSLATION_STATIC_GET_*_ENABLED`) — none of which were read at runtime. The live cacheComponents checks and `noLocalesCouldBeDeterminedWarning` are retained.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized

- Updated dependencies [[`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b), [`37e0080`](https://github.com/generaltranslation/gt/commit/37e0080b2c072840cf6c0f1c66a8f0f3a54e17e5), [`5bfd0a7`](https://github.com/generaltranslation/gt/commit/5bfd0a73e286bf76ae26f9178171aeca1c53ecc5), [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0), [`7a9dbe3`](https://github.com/generaltranslation/gt/commit/7a9dbe3c188787a39ee1de78f54c92dff470b502), [`1212135`](https://github.com/generaltranslation/gt/commit/1212135e4e09ed754756cac2805bc3a139408dc1), [`04f419d`](https://github.com/generaltranslation/gt/commit/04f419d65e69db3eb4adb8ee6299c0ddee153135), [`bd52e5e`](https://github.com/generaltranslation/gt/commit/bd52e5ef3fb38a63d9bac8a4af08ff93402c0749), [`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`42a440f`](https://github.com/generaltranslation/gt/commit/42a440ff3420bdbdb35ed24f9a5af1c9040eaf66), [`fd22c68`](https://github.com/generaltranslation/gt/commit/fd22c68978af50ce519dc06c7b887d3fa67181ae), [`bea8233`](https://github.com/generaltranslation/gt/commit/bea8233d8b055980483cb2e226157f6adcbd8c2b), [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0), [`5736d58`](https://github.com/generaltranslation/gt/commit/5736d585b8285ef56cc6f412799308969ac786c0), [`8d2e84e`](https://github.com/generaltranslation/gt/commit/8d2e84e5083bb740815004bec90eaa341be7aff5), [`04b5064`](https://github.com/generaltranslation/gt/commit/04b50645675abb9e927a82056b249b50f0907fcc), [`4335432`](https://github.com/generaltranslation/gt/commit/43354326beb16e13784b0c82faad447768bb8404), [`04c285c`](https://github.com/generaltranslation/gt/commit/04c285c7b44f5404918cd4c80336dddf412472e9), [`947fe0c`](https://github.com/generaltranslation/gt/commit/947fe0c97a2821a0980cd3e779252ea0078e80f8), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`55c77ea`](https://github.com/generaltranslation/gt/commit/55c77ea871f5c7bc333c046d89a32472e68f0f4b), [`e026c42`](https://github.com/generaltranslation/gt/commit/e026c42bc137e9865b548daee7238e6a458a5662), [`328795b`](https://github.com/generaltranslation/gt/commit/328795bf730296658a57b7132bbd1e0bbff2fd62), [`1f53e42`](https://github.com/generaltranslation/gt/commit/1f53e420e9a6475f85cf27e1cd0c9c89f4beeb36), [`b3bb391`](https://github.com/generaltranslation/gt/commit/b3bb391d33041680e2d62b6a7c9b05662946544f), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`44bc998`](https://github.com/generaltranslation/gt/commit/44bc998abf813ea4a96ade6c2632e1143034bd45), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`7744c55`](https://github.com/generaltranslation/gt/commit/7744c557d37c85ce3626681410cc0cd622374ecf), [`b7d44dc`](https://github.com/generaltranslation/gt/commit/b7d44dc2d79ac3332a0ed55da0ba130b6896f756), [`9561761`](https://github.com/generaltranslation/gt/commit/9561761c3ab72a5e39327415b3274eccc63f4ffe), [`72c6a85`](https://github.com/generaltranslation/gt/commit/72c6a85cc3ca025ebdeb006dbdd865e935ec77ae), [`3d95277`](https://github.com/generaltranslation/gt/commit/3d95277a057b28fffc73b3fa616210bdcb447e85), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`c1e0a0f`](https://github.com/generaltranslation/gt/commit/c1e0a0f837da440eeed84af10b553dee24bfc936), [`85a0c19`](https://github.com/generaltranslation/gt/commit/85a0c1998a6500233affd8c1987551170584c782), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b), [`e343775`](https://github.com/generaltranslation/gt/commit/e343775d8a41ce3eea03dd319b90497a9744cc4f), [`40db0c5`](https://github.com/generaltranslation/gt/commit/40db0c54a58e82d693d8a16d19fe5071baabecdc), [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793), [`c5364f9`](https://github.com/generaltranslation/gt/commit/c5364f977ffb4b387ad39206e6ed626bbeec56f3), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`2c46baf`](https://github.com/generaltranslation/gt/commit/2c46baf137400613495e3fe2865865b5506edece), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`9e78cf0`](https://github.com/generaltranslation/gt/commit/9e78cf07db58bfe6063bcd0b217553176c9681bd), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0), [`d863bcf`](https://github.com/generaltranslation/gt/commit/d863bcf05770c336c98b2b2fae8534c90f00df51), [`11ecf87`](https://github.com/generaltranslation/gt/commit/11ecf876a1221b9dbce9fc0c0f0804101558c8a7), [`03bae6d`](https://github.com/generaltranslation/gt/commit/03bae6d3b4791107781cb800c1ae7ac4f675705c), [`5d42608`](https://github.com/generaltranslation/gt/commit/5d426089f04f37dd7369620e9db3e6512f06eee8), [`9804aa4`](https://github.com/generaltranslation/gt/commit/9804aa460c07ec36d2e667d79a839720a1e011e8), [`338e5e8`](https://github.com/generaltranslation/gt/commit/338e5e8a42354c7d288d9be960ebd1d58adfd402), [`8834c51`](https://github.com/generaltranslation/gt/commit/8834c518ac84259706f2b603fd024ad13a9072ee), [`2ca78ec`](https://github.com/generaltranslation/gt/commit/2ca78ec4805639c10c7b200c8dee660b55eddf15), [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b)]:
  - gt-i18n@1.0.0
  - @generaltranslation/react-core@11.0.0
  - gt-react@11.0.0
  - generaltranslation@9.0.0
  - @generaltranslation/compiler@1.3.25
  - @generaltranslation/format@0.1.2
  - @generaltranslation/supported-locales@2.1.2

## 11.0.0-odysseus.16

### Major Changes

- 463a8db: Add a config-aware `resolveCanonicalLocale` helper and remove the public `getGTClass` helper.
- 463a8db: Remove the deprecated `useGTClass` hook from public entry points.
- 40db0c5: Remove `useVersionId` from public package entrypoints.

  The `getVersionId` helper remains available from public function entrypoints and `gt-i18n/internal`.

### Patch Changes

- 1a483ae: Remove deprecated Next internal packages.
- ce8a665: Clean up the `gt-next` API surface for the next major prerelease.

  Removes the deprecated `initGT` config alias and the redundant `gt-next/types` subpath. Moves the hidden dictionary and loader subpaths under `gt-next/internal/*`, updates the Next config alias plumbing to match, and adjusts CLI setup detection so it no longer treats `initGT` as a valid existing config wrapper.

- Updated dependencies [463a8db]
- Updated dependencies [b72c30b]
- Updated dependencies [bea8233]
- Updated dependencies [5736d58]
- Updated dependencies [1f53e42]
- Updated dependencies [7744c55]
- Updated dependencies [463a8db]
- Updated dependencies [e343775]
- Updated dependencies [40db0c5]
- Updated dependencies [d5cf2d3]
  - gt-i18n@1.0.0-odysseus.9
  - @generaltranslation/react-core@11.0.0-odysseus.16
  - gt-react@11.0.0-odysseus.16
  - generaltranslation@9.0.0-odysseus.6
  - @generaltranslation/compiler@1.3.25-odysseus.8
  - @generaltranslation/supported-locales@2.1.2-odysseus.6

## 11.0.0-odysseus.15

### Patch Changes

- 04f419d: Fix source interpolation for default-locale string helpers.
  Clarify that `tx()` does not apply ICU formatting by default.
- 98698de: Escape backslashes in middleware path regex input before dynamic path matching.
- 72e9e16: Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.
- 8d2e84e: Preserve enableI18n hydration state from server props and request cookies.
- 195f009: fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized
- Updated dependencies [04f419d]
- Updated dependencies [72e9e16]
- Updated dependencies [42a440f]
- Updated dependencies [8d2e84e]
- Updated dependencies [5adeede]
- Updated dependencies [c5364f9]
- Updated dependencies [2e85ebd]
- Updated dependencies [195f009]
  - @generaltranslation/react-core@11.0.0-odysseus.15
  - generaltranslation@9.0.0-odysseus.5
  - gt-i18n@1.0.0-odysseus.8
  - gt-react@11.0.0-odysseus.15
  - @generaltranslation/compiler@1.3.25-odysseus.7
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

- 00ae256: Delegate remote translation loading to the shared i18n cache and only pass custom Next.js translation loaders when configured.
- Updated dependencies [ab61565]
- Updated dependencies [0cd7813]
  - gt-i18n@1.0.0-odysseus.7
  - @generaltranslation/react-core@11.0.0-odysseus.14
  - gt-react@11.0.0-odysseus.14

## 11.0.0-odysseus.13

### Patch Changes

- a2b9677: Restore namespace scoping for getTranslations and server useTranslations.
- 3e199a2: Keep the locale cookie when the middleware clears the setLocale reset cookie. Deleting it raced with concurrent prefetch responses after a locale switch in production builds, causing client components to fall back to the browser's default locale while server components rendered the selected locale.
- Updated dependencies [a2b9677]
- Updated dependencies [41371e0]
  - gt-i18n@1.0.0-odysseus.6
  - gt-react@11.0.0-odysseus.13
  - @generaltranslation/react-core@11.0.0-odysseus.13

## 11.0.0-odysseus.12

### Patch Changes

- 31884d2: Initialize gt-next server entrypoints with a shared server condition store.
- Updated dependencies [7be23bc]
  - @generaltranslation/react-core@11.0.0-odysseus.12
  - gt-react@11.0.0-odysseus.12

## 11.0.0-odysseus.11

### Patch Changes

- fe7dfd3: Stop forwarding `locale={false}` from `gt-next/link` to the underlying Next.js link after localizing the href.

  This avoids React DOM warnings in newer Next.js versions where the control prop can reach the rendered anchor.

- Updated dependencies [c34cab3]
  - @generaltranslation/compiler@1.3.25-odysseus.6
  - @generaltranslation/react-core@11.0.0-odysseus.11
  - gt-react@11.0.0-odysseus.11

## 11.0.0-odysseus.10

### Patch Changes

- 432fa49: Use Next.js caching semantics for Cache Components by disabling GT cache expiry and development hot reload runtime translation.

  Async translation and dictionary lookup boundaries now keep synchronous access to the loaded snapshot, so APIs like `getGT` and `getTranslations` can still resolve strings after cache expiry is delegated to Next.js.

  Global singleton setup now preserves the first initialized instance instead of replacing it on later initialization attempts.

- 07f74f0: Clean up stale package metadata and align TanStack Start package entry points.
- 432fa49: Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

- 33d4be2: Point the `react-server` export condition at the RSC-specific declaration file so TypeScript no longer exposes client-only hooks in React Server Components.
- 75dc650: Remove the unused `getDomain` request-function plumbing from `gt-next`.

  `getDomain` was scaffolded (a throw-only `internal/_getDomain` stub, a `getDomainPath` config prop, a `getDomain` entry in the request-function registry, and a `_GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED` build env var) but never wired to any runtime consumer — no `getDomain()` request helper exists and nothing reads the env var. Removes the stub module, the `./internal/_getDomain` export, the config prop/registry entries, and the dead env var. `getLocale`/`getRegion` are unchanged.

- 8e0a992: Remove the deprecated SSG and experimental-locale-resolution code paths from `gt-next`.

  Drops the long-deprecated, runtime-dead config surface: `experimentalEnableSSG`, `experimentalLocaleResolution`/`experimentalLocaleResolutionParam`, the static request functions (`STATIC_REQUEST_FUNCTIONS`/`getStatic*` and their non-existent `internal/static/*` aliases), and `disableSSGWarnings`/`getStatic*Path` doc props. Removes `plugin/checks/ssgChecks.ts`, the experimental branch of `cacheComponentsChecks`, the related error/warning builders, and the corresponding build-time env vars (`_GENERALTRANSLATION_ENABLE_SSG`, `_GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION[_PARAM]`, `_GENERALTRANSLATION_STATIC_GET_*_ENABLED`) — none of which were read at runtime. The live cacheComponents checks and `noLocalesCouldBeDeterminedWarning` are retained.

- Updated dependencies [432fa49]
- Updated dependencies [07f74f0]
- Updated dependencies [432fa49]
- Updated dependencies [ee34fea]
- Updated dependencies [bcba6fd]
- Updated dependencies [933916e]
- Updated dependencies [b7b3eaf]
- Updated dependencies [dfb5fc9]
- Updated dependencies [4a5f8e8]
- Updated dependencies [288c9f8]
- Updated dependencies [083d306]
  - gt-i18n@1.0.0-odysseus.5
  - gt-react@11.0.0-odysseus.10
  - @generaltranslation/compiler@1.3.25-odysseus.5
  - @generaltranslation/react-core@11.0.0-odysseus.10

## 11.0.0-odysseus.9

### Patch Changes

- cf3e961: Remove 21 unused error/warning builders from `gt-next`'s `errors/createErrors.ts`.

  The following had no consumers anywhere: `createDictionaryTranslationError`, `createInvalidDictionaryEntryWarning`, `createInvalidDictionaryTranslationEntryWarning`, `createInvalidIcuDictionaryEntryError`, `createInvalidIcuDictionaryEntryWarning`, `createMismatchingHashWarning`, `createNoEntryFoundWarning`, `createRequiredPrefixError`, `createStringRenderError`, `createStringRenderWarning`, `createStringTranslationError`, `createTranslationLoadingWarning`, `dictionaryDisabledError`, `dictionaryNotFoundWarning`, `gtProviderUseClientError`, `missingVariablesError`, `noInitGTWarn`, `runtimeTranslationTimeoutWarning`, `txUseClientError`, `unresolvedGetLocaleBuildError`, `usingDefaultsWarning`. ~155 LOC of dead error-string code removed.
  - @generaltranslation/react-core@11.0.0-odysseus.9
  - gt-react@11.0.0-odysseus.9

## 11.0.0-odysseus.8

### Patch Changes

- Updated dependencies [26faa87]
- Updated dependencies [270b821]
- Updated dependencies [bffaa67]
- Updated dependencies [d602065]
- Updated dependencies [6da26e8]
  - generaltranslation@9.0.0-odysseus.4
  - gt-i18n@1.0.0-odysseus.4
  - @generaltranslation/react-core@11.0.0-odysseus.8
  - @generaltranslation/compiler@1.3.25-odysseus.4
  - gt-react@11.0.0-odysseus.8
  - @generaltranslation/supported-locales@2.1.2-odysseus.4

## 11.0.0-odysseus.7

### Patch Changes

- Updated dependencies [b1eef00]
- Updated dependencies [b765174]
- Updated dependencies [07bfb00]
  - generaltranslation@9.0.0-odysseus.3
  - gt-i18n@1.0.0-odysseus.3
  - @generaltranslation/react-core@11.0.0-odysseus.7
  - @generaltranslation/compiler@1.3.25-odysseus.3
  - gt-react@11.0.0-odysseus.7
  - @generaltranslation/supported-locales@2.1.2-odysseus.3

## 11.0.0-odysseus.6

### Patch Changes

- Updated dependencies [c1aa794]
- Updated dependencies [e0ace5b]
  - @generaltranslation/react-core@11.0.0-odysseus.6
  - gt-react@11.0.0-odysseus.6

## 11.0.0-odysseus.5

### Major Changes

- [#1690](https://github.com/generaltranslation/gt/pull/1690) [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce) Thanks [@bgub](https://github.com/bgub)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- [#1685](https://github.com/generaltranslation/gt/pull/1685) [`795147f`](https://github.com/generaltranslation/gt/commit/795147f5b00f948b2b1876a919c0a16cf53c52b6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow client i18n cache expiry to default to no expiry while preserving explicit cache expiry configuration.

- [#1688](https://github.com/generaltranslation/gt/pull/1688) [`2836b96`](https://github.com/generaltranslation/gt/commit/2836b964dcc1f005430c3fbcfb4f6ff3d948a3fb) Thanks [@bgub](https://github.com/bgub)! - Ship a dual ESM/CJS build for `gt-next` and add `import` export conditions.

  Previously `gt-next` was published as CJS only (no `import` condition), so bundlers resolved the entire gt dependency graph (`gt-react`, `@generaltranslation/react-core`, `generaltranslation`, `gt-i18n`, `@generaltranslation/format`) through the `require` condition. That forced CJS variants onto the client, which cannot be tree-shaken — shipping `gt-next`'s own server/error code and unused dependency exports to the browser.

  `gt-next` now emits unbundled `.mjs` output alongside the existing `.js` output, and every `exports` subpath exposes an `import` condition. Bundlers now resolve the gt graph as ESM, enabling tree-shaking across all gt packages. Measured on a real Next.js app, this cuts gt's total client bundle by ~19% gzip (≈96 kB → ≈78 kB) with no API changes.

  The ESM build sets `polyfillRequire: false` so rolldown does not inject a `createRequire`-from-`node:module` shim (server-only `require()` calls are provided `require` by the bundler), and marks the `index.rsc`/`index.client` entrypoints as having side effects so their top-level initialization is not tree-shaken away.

- [#1678](https://github.com/generaltranslation/gt/pull/1678) [`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

- [#1676](https://github.com/generaltranslation/gt/pull/1676) [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default exports from package entrypoints and internal source modules.

  Use named imports for affected public entrypoints, including `import { plugin } from 'gt-react-native/plugin'`. The `gt-next/link` entrypoint keeps its default export to match `next/link`.

- Updated dependencies [[`795147f`](https://github.com/generaltranslation/gt/commit/795147f5b00f948b2b1876a919c0a16cf53c52b6), [`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447), [`41c938c`](https://github.com/generaltranslation/gt/commit/41c938c0d00f4b76faa7a2805ad0015891e0740e), [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce)]:
  - gt-react@11.0.0-odysseus.5
  - @generaltranslation/format@0.1.2-odysseus.1
  - generaltranslation@9.0.0-odysseus.2
  - @generaltranslation/react-core@11.0.0-odysseus.5
  - gt-i18n@1.0.0-odysseus.2
  - @generaltranslation/compiler@1.3.25-odysseus.2
  - @generaltranslation/supported-locales@2.1.2-odysseus.2

## 11.0.0-odysseus.4

### Patch Changes

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - @generaltranslation/compiler@1.3.25-odysseus.1
  - generaltranslation@9.0.0-odysseus.1
  - gt-i18n@1.0.0-odysseus.1
  - gt-react@11.0.0-odysseus.4
  - @generaltranslation/react-core@11.0.0-odysseus.4
  - @generaltranslation/supported-locales@2.1.2-odysseus.1

## 7.0.0-odysseus.3

### Patch Changes

- [#1659](https://github.com/generaltranslation/gt/pull/1659) [`807dc30`](https://github.com/generaltranslation/gt/commit/807dc305c4b5e4ce8f6982d96886a530910f3f37) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a locale-aware Link component for Next.js applications.

  Transpile gt-next in Next apps so package runtime config is compiled with app env values. See #1661.

## 7.0.0-odysseus.2

### Patch Changes

- Updated dependencies [[`e29cd01`](https://github.com/generaltranslation/gt/commit/e29cd01c1bfe9ffba64c8fb3794d053a8c1304af)]:
  - gt-react@11.0.0-odysseus.2

## 7.0.0-odysseus.1

### Patch Changes

- [#1644](https://github.com/generaltranslation/gt/pull/1644) [`9652458`](https://github.com/generaltranslation/gt/commit/9652458372b09a746a9f241012cdfc75243cd7ea) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a Pages Router server-side props helper for GT locale and translation snapshots.

- [#1645](https://github.com/generaltranslation/gt/pull/1645) [`45a3241`](https://github.com/generaltranslation/gt/commit/45a3241decc10211fae84287ec74651f6864913d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Read Next runtime credentials from environment variables and keep them out of serialized config.

- Updated dependencies [[`30918cf`](https://github.com/generaltranslation/gt/commit/30918cfa7fdb2072691681027ab8ad79cd8b73a7)]:
  - gt-react@11.0.0-odysseus.1

## 7.0.0-odysseus.0

### Major Changes

- [#1627](https://github.com/generaltranslation/gt/pull/1627) [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`33203b1`](https://github.com/generaltranslation/gt/commit/33203b1953727647f61a21136b4c9570efbc8620), [`af441bd`](https://github.com/generaltranslation/gt/commit/af441bdfb3a4cabe28985c59104ab7d60ee83d83), [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - gt-react@11.0.0-odysseus.0
  - @generaltranslation/compiler@1.3.25-odysseus.0
  - @generaltranslation/format@0.1.2-odysseus.0
  - @generaltranslation/supported-locales@2.1.2-odysseus.0
  - generaltranslation@9.0.0-odysseus.0
  - gt-i18n@1.0.0-odysseus.0

## 6.16.35

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4
  - gt-i18n@0.9.8
  - gt-react@10.20.4

## 6.16.34

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - @generaltranslation/compiler@1.3.26
  - gt-i18n@0.9.7
  - gt-react@10.20.3
  - @generaltranslation/supported-locales@2.1.3

## 6.16.33

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - @generaltranslation/compiler@1.3.25
  - gt-i18n@0.9.6
  - gt-react@10.20.2
  - @generaltranslation/supported-locales@2.1.2

## 6.16.32

### Patch Changes

- Updated dependencies []:
  - gt-react@10.20.1

## 6.16.31

### Patch Changes

- Updated dependencies []:
  - gt-react@10.20.0

## 6.16.30

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - @generaltranslation/compiler@1.3.24
  - gt-i18n@0.9.5
  - gt-react@10.19.19
  - @generaltranslation/supported-locales@2.1.1

## 6.16.29

### Patch Changes

- [#1437](https://github.com/generaltranslation/gt/pull/1437) [`fd61c44`](https://github.com/generaltranslation/gt/commit/fd61c4487a790e0802021478986b8c5b3dc0fb2b) Thanks [@bgub](https://github.com/bgub)! - Deprecate `experimentalLocaleResolution` and update cache components warnings to recommend explicit custom `getLocale.ts` and `getRegion.ts` request functions instead of automatic root parameter detection.

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0
  - gt-i18n@0.9.4
  - gt-react@10.19.18

## 6.16.37

### Patch Changes

- [#1796](https://github.com/generaltranslation/gt/pull/1796) [`9f305a9`](https://github.com/generaltranslation/gt/commit/9f305a9209acbc773015e187a7da0c5c10083a52) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a withGTConfig flag for disabling invalid request locale warnings.

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - @generaltranslation/compiler@1.3.27
  - generaltranslation@8.2.19
  - gt-i18n@0.9.9
  - gt-react@10.20.5
  - @generaltranslation/supported-locales@2.1.5

## 6.16.36

### Patch Changes

- [#1768](https://github.com/generaltranslation/gt/pull/1768) [`da5385f`](https://github.com/generaltranslation/gt/commit/da5385f6ce6497c542a68d4c9207ce2bd0aa2a25) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retry main releases that were blocked by recent release workflow failures.

- [#1729](https://github.com/generaltranslation/gt/pull/1729) [`3b389dc`](https://github.com/generaltranslation/gt/commit/3b389dc08f3d86e2cea91a25e22840c188328d94) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fallback to the default locale when request locale resolution returns an invalid or unsupported locale. This prevents request-derived locale values from causing runtime errors, and adds `isLocaleSupported()` to `gt-next/server` for apps that want to explicitly reject invalid locale route params.

## 6.16.35

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4
  - gt-i18n@0.9.8
  - gt-react@10.20.4

## 6.16.34

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - @generaltranslation/compiler@1.3.26
  - gt-i18n@0.9.7
  - gt-react@10.20.3
  - @generaltranslation/supported-locales@2.1.3

## 6.16.33

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - @generaltranslation/compiler@1.3.25
  - gt-i18n@0.9.6
  - gt-react@10.20.2
  - @generaltranslation/supported-locales@2.1.2

## 6.16.32

### Patch Changes

- Updated dependencies []:
  - gt-react@10.20.1

## 6.16.31

### Patch Changes

- Updated dependencies []:
  - gt-react@10.20.0

## 6.16.30

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - @generaltranslation/compiler@1.3.24
  - gt-i18n@0.9.5
  - gt-react@10.19.19
  - @generaltranslation/supported-locales@2.1.1

## 6.16.29

### Patch Changes

- [#1437](https://github.com/generaltranslation/gt/pull/1437) [`fd61c44`](https://github.com/generaltranslation/gt/commit/fd61c4487a790e0802021478986b8c5b3dc0fb2b) Thanks [@bgub](https://github.com/bgub)! - Deprecate `experimentalLocaleResolution` and update cache components warnings to recommend explicit custom `getLocale.ts` and `getRegion.ts` request functions instead of automatic root parameter detection.

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0
  - gt-i18n@0.9.4
  - gt-react@10.19.18

## 6.16.28

### Patch Changes

- [#1419](https://github.com/generaltranslation/gt/pull/1419) [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300) Thanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages and package-local diagnostic formatting.

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15
  - gt-i18n@0.9.3
  - gt-react@10.19.17
  - @generaltranslation/compiler@1.3.23
  - @generaltranslation/supported-locales@2.0.73

## 6.16.27

### Patch Changes

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6), [`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14
  - gt-i18n@0.9.2
  - gt-react@10.19.16
  - @generaltranslation/compiler@1.3.22
  - @generaltranslation/supported-locales@2.0.72

## 6.16.26

### Patch Changes

- [#1386](https://github.com/generaltranslation/gt/pull/1386) [`f9f97a2`](https://github.com/generaltranslation/gt/commit/f9f97a2c1ce96fd79e50fa4bbd7d27139404bf06) Thanks [@bgub](https://github.com/bgub)! - Preserve user Next config types when wrapping with GT config.

- [#1387](https://github.com/generaltranslation/gt/pull/1387) [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796) Thanks [@bgub](https://github.com/bgub)! - Reduce explicit any usage in core and Next.js types.

- Updated dependencies [[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9), [`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e), [`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - gt-i18n@0.9.1
  - generaltranslation@8.2.13
  - gt-react@10.19.15
  - @generaltranslation/compiler@1.3.21
  - @generaltranslation/supported-locales@2.0.71

## 6.16.25

### Patch Changes

- [#1364](https://github.com/generaltranslation/gt/pull/1364) [`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0) Thanks [@pie575](https://github.com/pie575)! - Update Derive docs comments

- Updated dependencies [[`6a255fb`](https://github.com/generaltranslation/gt/commit/6a255fb7ee440c88f6374fe14e7b0008e051d3a8), [`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add), [`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016), [`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95), [`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f), [`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2), [`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0), [`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0), [`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a), [`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:
  - @generaltranslation/compiler@1.3.20
  - gt-i18n@0.9.0
  - gt-react@10.19.14
  - generaltranslation@8.2.12
  - @generaltranslation/supported-locales@2.0.70

## 6.16.24

### Patch Changes

- [#1348](https://github.com/generaltranslation/gt/pull/1348) [`6307dea`](https://github.com/generaltranslation/gt/commit/6307deac200eab9d5a9b2bc4edca080d49e4c131) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Clarify Babel compiler compatibility warnings for Turbopack and unsupported React versions.

- Updated dependencies [[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861), [`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4), [`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:
  - gt-i18n@0.8.14
  - gt-react@10.19.13

## 6.16.23

### Patch Changes

- [#1311](https://github.com/generaltranslation/gt/pull/1311) [`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24) Thanks [@bgub](https://github.com/bgub)! - Route gt-next cached and runtime translation lookups through I18nManager.

- Updated dependencies [[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8), [`5801996`](https://github.com/generaltranslation/gt/commit/58019961cf4142e5468fbbc523a514e3f90b4123), [`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e), [`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96), [`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda), [`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24), [`3dedd4a`](https://github.com/generaltranslation/gt/commit/3dedd4a07b674f7b943f963190232e5c0f01026f)]:
  - gt-i18n@0.8.13
  - @generaltranslation/compiler@1.3.19
  - gt-react@10.19.12

## 6.16.22

### Patch Changes

- Updated dependencies [[`b6098f8`](https://github.com/generaltranslation/gt/commit/b6098f87e2355e7d862d201c24b25467fb569015), [`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - @generaltranslation/compiler@1.3.18
  - generaltranslation@8.2.11
  - gt-i18n@0.8.12
  - gt-react@10.19.11
  - @generaltranslation/supported-locales@2.0.69

## 6.16.21

### Patch Changes

- Updated dependencies [[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:
  - gt-i18n@0.8.11
  - gt-react@10.19.10

## 6.16.20

### Patch Changes

- Updated dependencies [[`7ce1813`](https://github.com/generaltranslation/gt/commit/7ce18131c7a1e494fdc5c488e2f53d033b083311), [`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:
  - @generaltranslation/compiler@1.3.17
  - gt-i18n@0.8.10
  - gt-react@10.19.9

## 6.16.19

### Patch Changes

- Updated dependencies [[`7b1fd81`](https://github.com/generaltranslation/gt/commit/7b1fd816f8c8c9f2997bc0b9abe2cabd1dab00e8), [`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - @generaltranslation/compiler@1.3.16
  - generaltranslation@8.2.10
  - gt-i18n@0.8.9
  - gt-react@10.19.8
  - @generaltranslation/supported-locales@2.0.68

## 6.16.18

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - gt-i18n@0.8.8
  - @generaltranslation/compiler@1.3.15
  - gt-react@10.19.7
  - @generaltranslation/supported-locales@2.0.67

## 6.16.17

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - @generaltranslation/compiler@1.3.14
  - gt-i18n@0.8.7
  - gt-react@10.19.6
  - @generaltranslation/supported-locales@2.0.66

## 6.16.16

### Patch Changes

- Updated dependencies [[`28d0c06`](https://github.com/generaltranslation/gt/commit/28d0c06f3e8366fc2c119b7792620c4764eda2de)]:
  - @generaltranslation/compiler@1.3.13

## 6.16.15

### Patch Changes

- [#1266](https://github.com/generaltranslation/gt/pull/1266) [`0c22b7a`](https://github.com/generaltranslation/gt/commit/0c22b7a7dd87db7657eb1ffee0444a054c6744fa) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: access locale for metadata

## 6.16.14

### Patch Changes

- Updated dependencies [[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:
  - gt-i18n@0.8.6
  - gt-react@10.19.5

## 6.16.13

### Patch Changes

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- Updated dependencies [[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8), [`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - gt-i18n@0.8.5
  - generaltranslation@8.2.7
  - gt-react@10.19.4
  - @generaltranslation/supported-locales@2.0.65
  - @generaltranslation/compiler@1.3.12

## 6.16.12

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - @generaltranslation/compiler@1.3.11
  - gt-i18n@0.8.4
  - gt-react@10.19.3
  - @generaltranslation/supported-locales@2.0.64

## 6.16.11

### Patch Changes

- Updated dependencies [[`3d6c60e`](https://github.com/generaltranslation/gt/commit/3d6c60e1595bc9409a2d21a153caa5f909154691)]:
  - @generaltranslation/compiler@1.3.10

## 6.16.10

### Patch Changes

- Updated dependencies [[`2e1869d`](https://github.com/generaltranslation/gt/commit/2e1869d464714427e018911c61bd06b2cf5bb900)]:
  - @generaltranslation/compiler@1.3.9

## 6.16.9

### Patch Changes

- Updated dependencies []:
  - gt-react@10.19.2

## 6.16.8

### Patch Changes

- Updated dependencies []:
  - gt-react@10.19.1

## 6.16.7

### Patch Changes

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - gt-react@10.19.0
  - @generaltranslation/compiler@1.3.8
  - generaltranslation@8.2.5
  - gt-i18n@0.8.3
  - @generaltranslation/supported-locales@2.0.63

## 6.16.6

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - @generaltranslation/compiler@1.3.7
  - gt-i18n@0.8.2
  - gt-react@10.18.3
  - @generaltranslation/supported-locales@2.0.62

## 6.16.5

### Patch Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - gt-react@10.18.2
  - generaltranslation@8.2.3
  - gt-i18n@0.8.1
  - @generaltranslation/compiler@1.3.6
  - @generaltranslation/supported-locales@2.0.61

## 6.16.4

### Patch Changes

- [#1199](https://github.com/generaltranslation/gt/pull/1199) [`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable autoderive for jsx

- [#1200](https://github.com/generaltranslation/gt/pull/1200) [`223fc66`](https://github.com/generaltranslation/gt/commit/223fc66506e7ec1dc4d6261d9003e6c377d4f5e5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: spread derivation

- [#1201](https://github.com/generaltranslation/gt/pull/1201) [`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: customize autoderive

- Updated dependencies [[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f), [`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be), [`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)]:
  - @generaltranslation/compiler@1.3.5
  - gt-react@10.18.1

## 6.16.3

### Patch Changes

- [#1195](https://github.com/generaltranslation/gt/pull/1195) [`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: standardize naming convention for "autoderive"

- Updated dependencies [[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)]:
  - @generaltranslation/compiler@1.3.4

## 6.16.2

### Patch Changes

- [#1189](https://github.com/generaltranslation/gt/pull/1189) [`7efceb8`](https://github.com/generaltranslation/gt/commit/7efceb83796f975eed9354b1e706853dd4e06aef) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(swc): support autoDerive flag in SWC plugin to allow bare variables and function calls in gt() template literals and concatenations

- Updated dependencies [[`a76a386`](https://github.com/generaltranslation/gt/commit/a76a38624a2defbfd8d0540ccb74bb264079f61a)]:
  - @generaltranslation/compiler@1.3.3

## 6.16.1

### Patch Changes

- Updated dependencies [[`80fe63f`](https://github.com/generaltranslation/gt/commit/80fe63fa349f8ece0871ba455f16dae614327fdd)]:
  - @generaltranslation/compiler@1.3.2

## 6.16.0

### Minor Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

### Patch Changes

- Updated dependencies [[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:
  - gt-i18n@0.8.0
  - gt-react@10.18.0
  - @generaltranslation/compiler@1.3.1

## 6.15.2

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - gt-react@10.17.0
  - @generaltranslation/supported-locales@2.0.60
  - @generaltranslation/compiler@1.3.0
  - generaltranslation@8.2.2
  - gt-i18n@0.7.10

## 6.15.1

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - gt-react@10.16.1
  - gt-i18n@0.7.9
  - generaltranslation@8.2.1
  - @generaltranslation/compiler@1.2.1
  - @generaltranslation/supported-locales@2.0.59

## 6.15.0

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
  - gt-react@10.16.0
  - @generaltranslation/compiler@1.2.0
  - gt-i18n@0.7.8
  - @generaltranslation/supported-locales@2.0.58

## 6.14.8

### Patch Changes

- Updated dependencies [[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:
  - gt-i18n@0.7.7
  - gt-react@10.15.6

## 6.14.7

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - @generaltranslation/compiler@1.1.36
  - generaltranslation@8.1.23
  - gt-i18n@0.7.6
  - gt-react@10.15.5
  - @generaltranslation/supported-locales@2.0.57

## 6.14.6

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - @generaltranslation/compiler@1.1.35
  - gt-i18n@0.7.5
  - gt-react@10.15.4
  - @generaltranslation/supported-locales@2.0.56

## 6.14.5

### Patch Changes

- Updated dependencies [[`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca)]:
  - @generaltranslation/compiler@1.1.34

## 6.14.4

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - @generaltranslation/compiler@1.1.33
  - gt-i18n@0.7.4
  - gt-react@10.15.3
  - @generaltranslation/supported-locales@2.0.55

## 6.14.3

### Patch Changes

- Updated dependencies [[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:
  - @generaltranslation/supported-locales@2.0.54
  - gt-i18n@0.7.3
  - gt-react@10.15.2

## 6.14.2

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - @generaltranslation/compiler@1.1.32
  - generaltranslation@8.1.20
  - gt-i18n@0.7.2
  - gt-react@10.15.1
  - @generaltranslation/supported-locales@2.0.53

## 6.14.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - gt-react@10.15.0
  - @generaltranslation/supported-locales@2.0.52
  - @generaltranslation/compiler@1.1.31
  - generaltranslation@8.1.19
  - gt-i18n@0.7.1

## 6.14.0

### Minor Changes

- [#1121](https://github.com/generaltranslation/gt/pull/1121) [`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5) Thanks [@pie575](https://github.com/pie575)! - Added a versionId hook for users to better access what Version their GT translations are on

### Patch Changes

- Updated dependencies [[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5), [`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - gt-react@10.14.0
  - gt-i18n@0.7.0
  - generaltranslation@8.1.18
  - @generaltranslation/compiler@1.1.30
  - @generaltranslation/supported-locales@2.0.51

## 6.13.11

### Patch Changes

- Updated dependencies [[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:
  - gt-react@10.13.0
  - @generaltranslation/compiler@1.1.29
  - gt-i18n@0.6.2

## 6.13.10

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - @generaltranslation/compiler@1.1.28
  - gt-react@10.12.1
  - generaltranslation@8.1.17
  - gt-i18n@0.6.1
  - @generaltranslation/supported-locales@2.0.50

## 6.13.9

### Patch Changes

- Updated dependencies [[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:
  - gt-react@10.12.0
  - gt-i18n@0.6.0

## 6.13.8

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - @generaltranslation/compiler@1.1.27
  - gt-i18n@0.5.2
  - gt-react@10.11.7
  - @generaltranslation/supported-locales@2.0.49

## 6.13.7

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - @generaltranslation/compiler@1.1.26
  - gt-i18n@0.5.1
  - gt-react@10.11.6
  - @generaltranslation/supported-locales@2.0.48

## 6.13.6

### Patch Changes

- Updated dependencies [[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:
  - gt-i18n@0.5.0
  - gt-react@10.11.5

## 6.13.5

### Patch Changes

- [#1076](https://github.com/generaltranslation/gt/pull/1076) [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply style guide to error messages and warnings: remove "Please", simplify verbose phrasing, fix `in-line` → `inline`.

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76), [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:
  - generaltranslation@8.1.14
  - @generaltranslation/compiler@1.1.25
  - gt-i18n@0.4.2
  - gt-react@10.11.4
  - @generaltranslation/supported-locales@2.0.47

## 6.13.4

### Patch Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

- Updated dependencies [[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:
  - @generaltranslation/compiler@1.1.24
  - gt-react@10.11.3

## 6.13.3

### Patch Changes

- [#1068](https://github.com/generaltranslation/gt/pull/1068) [`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: runtime calculation for the injection of 'data-' attribute in jsx

- Updated dependencies [[`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b)]:
  - @generaltranslation/compiler@1.1.23
  - gt-react@10.11.2

## 6.13.2

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13
  - @generaltranslation/compiler@1.1.22
  - gt-i18n@0.4.1
  - gt-react@10.11.1
  - @generaltranslation/supported-locales@2.0.46

## 6.13.1

### Patch Changes

- [#1055](https://github.com/generaltranslation/gt/pull/1055) [`8f114ec`](https://github.com/generaltranslation/gt/commit/8f114eccffad67c8d7f54d32502d50ce509faf67) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: bump patch

## 6.13.0

### Minor Changes

- [#1051](https://github.com/generaltranslation/gt/pull/1051) [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: string list registration

### Patch Changes

- Updated dependencies [[`065cfaf`](https://github.com/generaltranslation/gt/commit/065cfaf4e6ac220755a9667b58731520d64fef85), [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533)]:
  - gt-i18n@0.4.0
  - gt-react@10.11.0

## 6.12.17

### Patch Changes

- [#1046](https://github.com/generaltranslation/gt/pull/1046) [`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d) Thanks [@brian-lou](https://github.com/brian-lou)! - Update /translate endpoint

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12
  - gt-react@10.10.14
  - @generaltranslation/compiler@1.1.21
  - gt-i18n@0.3.12
  - @generaltranslation/supported-locales@2.0.45

## 6.12.16

### Patch Changes

- [#1033](https://github.com/generaltranslation/gt/pull/1033) [`eb7855b`](https://github.com/generaltranslation/gt/commit/eb7855b6e35a244395da7d01e3b9b659884c6488) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: remove window.location.reload on locale change for gt-next

- Updated dependencies [[`eb7855b`](https://github.com/generaltranslation/gt/commit/eb7855b6e35a244395da7d01e3b9b659884c6488)]:
  - gt-react@10.10.13

## 6.12.15

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11
  - @generaltranslation/compiler@1.1.20
  - gt-i18n@0.3.11
  - gt-react@10.10.12
  - @generaltranslation/supported-locales@2.0.44

## 6.12.14

### Patch Changes

- Updated dependencies [[`573287c`](https://github.com/generaltranslation/gt/commit/573287cb6ac3429c8dd276230e7f5bebf9077230)]:
  - @generaltranslation/supported-locales@2.0.43
  - gt-i18n@0.3.10
  - gt-react@10.10.11

## 6.12.13

### Patch Changes

- Updated dependencies [[`06104b0`](https://github.com/generaltranslation/gt/commit/06104b075e14b2299490e645ce1d313224aac639)]:
  - @generaltranslation/supported-locales@2.0.42
  - gt-i18n@0.3.9
  - gt-react@10.10.10

## 6.12.12

### Patch Changes

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5), [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31)]:
  - generaltranslation@8.1.10
  - gt-react@10.10.9
  - gt-i18n@0.3.8
  - @generaltranslation/compiler@1.1.19
  - @generaltranslation/supported-locales@2.0.41

## 6.12.11

### Patch Changes

- Updated dependencies [[`2ab07fa`](https://github.com/generaltranslation/gt/commit/2ab07fad1e590fb4499879e474e14079dd2c223e)]:
  - gt-react@10.10.8

## 6.12.10

### Patch Changes

- [#1012](https://github.com/generaltranslation/gt/pull/1012) [`d49a81a`](https://github.com/generaltranslation/gt/commit/d49a81ad580dbddca464a4e8c8d0563f46907ee0) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Re-export msg and related functions from gt-next/server in order to improve dev experience when using getMessages

- Updated dependencies [[`7c0a319`](https://github.com/generaltranslation/gt/commit/7c0a31917215bd77528f9e8f01c29a113f8f25c6)]:
  - gt-i18n@0.3.7
  - gt-react@10.10.7

## 6.12.9

### Patch Changes

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df)]:
  - generaltranslation@8.1.9
  - @generaltranslation/compiler@1.1.18
  - gt-react@10.10.6
  - @generaltranslation/supported-locales@2.0.40

## 6.12.8

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8
  - @generaltranslation/compiler@1.1.17
  - gt-react@10.10.5
  - @generaltranslation/supported-locales@2.0.39

## 6.12.7

### Patch Changes

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7
  - @generaltranslation/compiler@1.1.16
  - gt-react@10.10.4
  - @generaltranslation/supported-locales@2.0.38

## 6.12.6

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6
  - @generaltranslation/compiler@1.1.15
  - gt-react@10.10.3
  - @generaltranslation/supported-locales@2.0.37

## 6.12.5

### Patch Changes

- Updated dependencies [[`dcdd751`](https://github.com/generaltranslation/gt/commit/dcdd7516edfe2e51ed633c79bc2045fb14fd938b)]:
  - @generaltranslation/compiler@1.1.14

## 6.12.4

### Patch Changes

- [#925](https://github.com/generaltranslation/gt/pull/925) [`6df7670`](https://github.com/generaltranslation/gt/commit/6df76703afeb2dc1c782f0f2da9d46208975906b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: deprecate swc plugin for nextjs versions earlier than 16.1

## 6.12.3

### Patch Changes

- Updated dependencies [[`4def431`](https://github.com/generaltranslation/gt/commit/4def4316c4e9fe0de02d091a2320667a0f86284a)]:
  - @generaltranslation/supported-locales@2.0.36
  - gt-react@10.10.2

## 6.12.2

### Patch Changes

- [#914](https://github.com/generaltranslation/gt/pull/914) [`d3c9368`](https://github.com/generaltranslation/gt/commit/d3c93686456d9077fcaa33f384e5287157c4606f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: disable swc plugin (temporary)

## 6.12.1

### Patch Changes

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5
  - @generaltranslation/compiler@1.1.13
  - gt-react@10.10.1
  - @generaltranslation/supported-locales@2.0.35

## 6.12.0

### Minor Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

### Patch Changes

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - gt-react@10.10.0
  - @generaltranslation/compiler@1.1.12
  - generaltranslation@8.1.4
  - @generaltranslation/supported-locales@2.0.34

## 6.11.3

### Patch Changes

- [#888](https://github.com/generaltranslation/gt/pull/888) [`6314624`](https://github.com/generaltranslation/gt/commit/6314624cd6d537e236e7208b1097dc137befab66) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: readme

- Updated dependencies [[`6314624`](https://github.com/generaltranslation/gt/commit/6314624cd6d537e236e7208b1097dc137befab66)]:
  - gt-react@10.9.3

## 6.11.2

### Patch Changes

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3
  - @generaltranslation/compiler@1.1.11
  - gt-react@10.9.2
  - @generaltranslation/supported-locales@2.0.33

## 6.11.1

### Patch Changes

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2
  - @generaltranslation/compiler@1.1.10
  - gt-react@10.9.1
  - @generaltranslation/supported-locales@2.0.32

## 6.11.0

### Minor Changes

- [#859](https://github.com/generaltranslation/gt/pull/859) [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: max chars

### Patch Changes

- Updated dependencies [[`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71), [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab), [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab)]:
  - generaltranslation@8.1.1
  - gt-react@10.9.0
  - @generaltranslation/compiler@1.1.9
  - @generaltranslation/supported-locales@2.0.31

## 6.10.3

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0
  - @generaltranslation/compiler@1.1.8
  - gt-react@10.8.7
  - @generaltranslation/supported-locales@2.0.30

## 6.10.2

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6
  - @generaltranslation/compiler@1.1.7
  - gt-react@10.8.6
  - @generaltranslation/supported-locales@2.0.29

## 6.10.1

### Patch Changes

- [#855](https://github.com/generaltranslation/gt/pull/855) [`a46a1ff`](https://github.com/generaltranslation/gt/commit/a46a1ff63b24636d28807407da4574ac1e987293) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: experimental locale resolution validation

## 6.10.0

### Minor Changes

- [#842](https://github.com/generaltranslation/gt/pull/842) [`3f19da3`](https://github.com/generaltranslation/gt/commit/3f19da3fd8b3e1813bef63471c0e5419cefc4c1d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: use cache

## 6.9.5

### Patch Changes

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5
  - @generaltranslation/compiler@1.1.6
  - gt-react@10.8.5
  - @generaltranslation/supported-locales@2.0.28

## 6.9.4

### Patch Changes

- Updated dependencies [[`73d78b2`](https://github.com/generaltranslation/gt/commit/73d78b20e067fd291080856d33dd1bd2656b3399)]:
  - gt-react@10.8.4

## 6.9.3

### Patch Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - @generaltranslation/supported-locales@2.0.27
  - @generaltranslation/compiler@1.1.5
  - gt-react@10.8.3
  - generaltranslation@8.0.4

## 6.9.2

### Patch Changes

- Updated dependencies [[`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831)]:
  - generaltranslation@8.0.3
  - @generaltranslation/compiler@1.1.4
  - gt-react@10.8.2
  - @generaltranslation/supported-locales@2.0.26

## 6.9.1

### Patch Changes

- [#813](https://github.com/generaltranslation/gt/pull/813) [`3ec2b2c`](https://github.com/generaltranslation/gt/commit/3ec2b2cc0df7a14451264209958bbf3583bdb55a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: require root param support for SSG

- Updated dependencies [[`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915)]:
  - generaltranslation@8.0.2
  - @generaltranslation/compiler@1.1.3
  - gt-react@10.8.1
  - @generaltranslation/supported-locales@2.0.25

## 6.9.0

### Minor Changes

- [#811](https://github.com/generaltranslation/gt/pull/811) [`ef81f68`](https://github.com/generaltranslation/gt/commit/ef81f687655a2bae9a00160940ce30f6cfebf54d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: ssg support

## 6.8.3

### Patch Changes

- Updated dependencies [[`a287f6f`](https://github.com/generaltranslation/gt/commit/a287f6fc79cc96acdc082fc4ff664bb23d0f0e3c)]:
  - gt-react@10.8.0

## 6.8.2

### Patch Changes

- Updated dependencies [[`b0715ff`](https://github.com/generaltranslation/gt/commit/b0715ffd91c119c4546790f03f1cfcafcae00c3f)]:
  - @generaltranslation/compiler@1.1.2

## 6.8.1

### Patch Changes

- Updated dependencies [[`f98c504`](https://github.com/generaltranslation/gt/commit/f98c504f1e025024b3e1e5e16a0271e86ed095fa)]:
  - generaltranslation@8.0.1
  - @generaltranslation/compiler@1.1.1
  - gt-react@10.7.1
  - @generaltranslation/supported-locales@2.0.24

## 6.8.0

### Minor Changes

- [#788](https://github.com/generaltranslation/gt/pull/788) [`99e4648`](https://github.com/generaltranslation/gt/commit/99e46486ae2046c689e0045372d63c4eb3dc5d48) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - More information: https://https://generaltranslation.com/en-US/blog/gt-next_v6_8_0

  feat: static component

### Patch Changes

- Updated dependencies [[`99e4648`](https://github.com/generaltranslation/gt/commit/99e46486ae2046c689e0045372d63c4eb3dc5d48), [`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719)]:
  - @generaltranslation/compiler@1.1.0
  - gt-react@10.7.0
  - generaltranslation@8.0.0
  - @generaltranslation/supported-locales@2.0.23

## 6.7.19

### Patch Changes

- Updated dependencies [[`3da05a1`](https://github.com/generaltranslation/gt/commit/3da05a12a37a62ace3c7e321aa2fed5a4af52ad9)]:
  - generaltranslation@7.9.1
  - @generaltranslation/compiler@1.0.9
  - gt-react@10.6.16
  - @generaltranslation/supported-locales@2.0.22

## 6.7.18

### Patch Changes

- Updated dependencies [[`93881f1`](https://github.com/generaltranslation/gt/commit/93881f159455a9bbc13d14e7fec9befa60998ba3)]:
  - generaltranslation@7.9.0
  - @generaltranslation/compiler@1.0.8
  - gt-react@10.6.15
  - @generaltranslation/supported-locales@2.0.21

## 6.7.17

### Patch Changes

- [#782](https://github.com/generaltranslation/gt/pull/782) [`155fc2c`](https://github.com/generaltranslation/gt/commit/155fc2c987078b2ffc12c55abb65bb7ff16eb09b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: only throw errors in development for invalid icu strings

- Updated dependencies [[`155fc2c`](https://github.com/generaltranslation/gt/commit/155fc2c987078b2ffc12c55abb65bb7ff16eb09b)]:
  - gt-react@10.6.14

## 6.7.16

### Patch Changes

- Updated dependencies [[`7434c15`](https://github.com/generaltranslation/gt/commit/7434c1503c2a62bdb90d4058f903a56331276365)]:
  - generaltranslation@7.8.0
  - @generaltranslation/compiler@1.0.7
  - gt-react@10.6.13
  - @generaltranslation/supported-locales@2.0.20

## 6.7.15

### Patch Changes

- Updated dependencies []:
  - gt-react@10.6.12

## 6.7.14

### Patch Changes

- [#765](https://github.com/generaltranslation/gt/pull/765) [`624a48c`](https://github.com/generaltranslation/gt/commit/624a48ccaacda9d416cb134802e6f1c14ac37936) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: undefined rendersettings error

## 6.7.13

### Patch Changes

- [#761](https://github.com/generaltranslation/gt/pull/761) [`1499720`](https://github.com/generaltranslation/gt/commit/149972082ec9ce02953cdbb3290e9a0364e58a33) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - refactor: msg() function now returns plain text

- Updated dependencies [[`1499720`](https://github.com/generaltranslation/gt/commit/149972082ec9ce02953cdbb3290e9a0364e58a33)]:
  - gt-react@10.6.11

## 6.7.12

### Patch Changes

- [#759](https://github.com/generaltranslation/gt/pull/759) [`cf04026`](https://github.com/generaltranslation/gt/commit/cf04026df7072af60999f281ba342a1baa58f7ff) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Migrating downloaded-versions.json to gt-lock.json, make .gt and .locadex interchangable

## 6.7.11

### Patch Changes

- Updated dependencies [[`7ba2e84`](https://github.com/generaltranslation/gt/commit/7ba2e8412b608aa3415f4865dc26adbbd3daa236)]:
  - generaltranslation@7.7.3
  - @generaltranslation/compiler@1.0.6
  - gt-react@10.6.10
  - @generaltranslation/supported-locales@2.0.19

## 6.7.10

### Patch Changes

- Updated dependencies [[`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701)]:
  - generaltranslation@7.7.2
  - @generaltranslation/compiler@1.0.5
  - gt-react@10.6.9
  - @generaltranslation/supported-locales@2.0.18

## 6.7.9

### Patch Changes

- Updated dependencies [[`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a)]:
  - generaltranslation@7.7.1
  - @generaltranslation/compiler@1.0.4
  - gt-react@10.6.8
  - @generaltranslation/supported-locales@2.0.17

## 6.7.8

### Patch Changes

- [#749](https://github.com/generaltranslation/gt/pull/749) [`29d202f`](https://github.com/generaltranslation/gt/commit/29d202f3b674c77310df687deb8e9d8778499c3e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: erroring when no locale headers were provided
  Thank you to [@bgub](https://github.com/bgub) for pointing this out!

## 6.7.7

### Patch Changes

- [#746](https://github.com/generaltranslation/gt/pull/746) [`83a5b26`](https://github.com/generaltranslation/gt/commit/83a5b26cc70f9a7378bbcafbf6c035462598fc8a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: modularize gt-react package

- Updated dependencies [[`83a5b26`](https://github.com/generaltranslation/gt/commit/83a5b26cc70f9a7378bbcafbf6c035462598fc8a)]:
  - gt-react@10.6.7

## 6.7.6

### Patch Changes

- Updated dependencies [[`5208937`](https://github.com/generaltranslation/gt/commit/520893719480b40774ccd749fe73727cf490f46c)]:
  - generaltranslation@7.7.0
  - @generaltranslation/compiler@1.0.3
  - gt-react@10.6.6
  - @generaltranslation/supported-locales@2.0.16

## 6.7.5

### Patch Changes

- [#743](https://github.com/generaltranslation/gt/pull/743) [`562b80f`](https://github.com/generaltranslation/gt/commit/562b80f3a57c72e9776d9d8392586cb11db128c9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add support for next@16 beta

## 6.7.4

### Patch Changes

- Updated dependencies [[`ed93e41`](https://github.com/generaltranslation/gt/commit/ed93e419e9547e6f2353d99f896702016f8ba751)]:
  - gt-react@10.6.5
  - generaltranslation@7.6.5
  - @generaltranslation/compiler@1.0.2
  - @generaltranslation/supported-locales@2.0.15

## 6.7.3

### Patch Changes

- [#731](https://github.com/generaltranslation/gt/pull/731) [`6896570`](https://github.com/generaltranslation/gt/commit/68965708f43f1bdd0315aa96ce69b6ef6d68260d) Thanks [@SamEggert](https://github.com/SamEggert)! - check for gt.config.json in the .locadex directory

## 6.7.2

### Patch Changes

- [#729](https://github.com/generaltranslation/gt/pull/729) [`718299b`](https://github.com/generaltranslation/gt/commit/718299b6827e02725103d6bd6f0fce4d39024110) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: react module resolution for client runtime error

## 6.7.1

### Patch Changes

- Updated dependencies [[`3cb2e06`](https://github.com/generaltranslation/gt/commit/3cb2e06490820d6a27d2dc3e749044a81c48a07a)]:
  - @generaltranslation/compiler@1.0.1

## 6.7.0

### Minor Changes

- [#575](https://github.com/generaltranslation/gt/pull/575) [`fa9c8d6`](https://github.com/generaltranslation/gt/commit/fa9c8d695ca8d17d03c79dee524f47f25ea63728) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: babel compiler

### Patch Changes

- Updated dependencies [[`fa9c8d6`](https://github.com/generaltranslation/gt/commit/fa9c8d695ca8d17d03c79dee524f47f25ea63728)]:
  - @generaltranslation/compiler@1.0.0

## 6.6.6

### Patch Changes

- [#708](https://github.com/generaltranslation/gt/pull/708) [`83bd501`](https://github.com/generaltranslation/gt/commit/83bd501ab0ba342d6974685dacbcb8b800f20145) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add memoization to useGT and useMessages callbacks

- Updated dependencies [[`83bd501`](https://github.com/generaltranslation/gt/commit/83bd501ab0ba342d6974685dacbcb8b800f20145)]:
  - gt-react@10.6.4

## 6.6.5

### Patch Changes

- [#706](https://github.com/generaltranslation/gt/pull/706) [`df39ab3`](https://github.com/generaltranslation/gt/commit/df39ab33c48096a66a7c8843aa24325504176277) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: ignore browser locale

## 6.6.4

### Patch Changes

- [#698](https://github.com/generaltranslation/gt/pull/698) [`9eefc14`](https://github.com/generaltranslation/gt/commit/9eefc14577013fcfa699344c4a950c12d3b3350b) Thanks [@brian-lou](https://github.com/brian-lou)! - Switch monorepo package manager to pnpm (no new features or bugs fixed). Please report issues to https://github.com/generaltranslation/gt

- Updated dependencies [[`9eefc14`](https://github.com/generaltranslation/gt/commit/9eefc14577013fcfa699344c4a950c12d3b3350b)]:
  - @generaltranslation/supported-locales@2.0.14
  - gt-react@10.6.3
  - generaltranslation@7.6.4

## 6.6.3

### Patch Changes

- [#692](https://github.com/generaltranslation/gt/pull/692) [`c86fc88`](https://github.com/generaltranslation/gt/commit/c86fc882b92c875b93328178e9211ec414d69011) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: canonical locale issues in middleware

## 6.6.2

### Patch Changes

- [#680](https://github.com/generaltranslation/gt/pull/680) [`a73a532`](https://github.com/generaltranslation/gt/commit/a73a5323bbcaace8955a2261dae1bba20955c67b) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Improved types for getLocaleDirection

## 6.6.1

### Patch Changes

- [#673](https://github.com/generaltranslation/gt/pull/673) [`250d8d2`](https://github.com/generaltranslation/gt/commit/250d8d275871cf2915fe51d633691b8ae546d9b2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: return type for t.obj

- Updated dependencies [[`250d8d2`](https://github.com/generaltranslation/gt/commit/250d8d275871cf2915fe51d633691b8ae546d9b2)]:
  - gt-react@10.6.1

## 6.6.0

### Minor Changes

- [#659](https://github.com/generaltranslation/gt/pull/659) [`59e922a`](https://github.com/generaltranslation/gt/commit/59e922a97719f35c6ac9c783c48d50111fec3836) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: access dictinoary subtrees via t.obj()

### Patch Changes

- Updated dependencies [[`59e922a`](https://github.com/generaltranslation/gt/commit/59e922a97719f35c6ac9c783c48d50111fec3836)]:
  - gt-react@10.6.0

## 6.4.1

### Patch Changes

- [#648](https://github.com/generaltranslation/gt/pull/648) [`c8facea`](https://github.com/generaltranslation/gt/commit/c8facead18a3c581e9d4ca53224ab17b8ce1e059) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: MFunctionType required fields

- Updated dependencies [[`c8facea`](https://github.com/generaltranslation/gt/commit/c8facead18a3c581e9d4ca53224ab17b8ce1e059)]:
  - gt-react@10.5.1

## 6.4.0

### Minor Changes

- [#638](https://github.com/generaltranslation/gt/pull/638) [`16bf30d`](https://github.com/generaltranslation/gt/commit/16bf30d70a0599ec863305f4f7a5a0852dd07e5d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add locale aliasing

### Patch Changes

- Updated dependencies [[`16bf30d`](https://github.com/generaltranslation/gt/commit/16bf30d70a0599ec863305f4f7a5a0852dd07e5d)]:
  - gt-react@10.5.0
  - generaltranslation@7.5.0

## 6.3.6

### Patch Changes

- [#633](https://github.com/generaltranslation/gt/pull/633) [`c21ca5a`](https://github.com/generaltranslation/gt/commit/c21ca5a187c64942d4702ebd99aee8aff8ae7dab) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added typing and allowed null | undefined for the useMessages m function

- Updated dependencies [[`c21ca5a`](https://github.com/generaltranslation/gt/commit/c21ca5a187c64942d4702ebd99aee8aff8ae7dab)]:
  - gt-react@10.4.3

## 6.3.5

### Patch Changes

- [#615](https://github.com/generaltranslation/gt/pull/615) [`73f6b71`](https://github.com/generaltranslation/gt/commit/73f6b712e73e5dd54dd87c7f8a7e2b337a0379d1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: use client import locale

## 6.3.4

### Patch Changes

- [#613](https://github.com/generaltranslation/gt/pull/613) [`48ddbd0`](https://github.com/generaltranslation/gt/commit/48ddbd00ff57a955a84b0f55ee2562052f3a9860) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: middleware and ssg

## 6.3.3

### Patch Changes

- [#609](https://github.com/generaltranslation/gt/pull/609) [`086d86e`](https://github.com/generaltranslation/gt/commit/086d86e0f6b5deeb62b78a68ebd61d398b7744ed) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: translation resolution error for useTranslations with local translations

- Updated dependencies [[`086d86e`](https://github.com/generaltranslation/gt/commit/086d86e0f6b5deeb62b78a68ebd61d398b7744ed)]:
  - gt-react@10.4.2

## 6.3.2

### Patch Changes

- [#602](https://github.com/generaltranslation/gt/pull/602) [`c1cfb63`](https://github.com/generaltranslation/gt/commit/c1cfb63c3f40f0bbe53fe3354431be38d2ab3b79) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: SWC plugin resolution for windows

## 6.3.1

### Patch Changes

- [#604](https://github.com/generaltranslation/gt/pull/604) [`43c6a76`](https://github.com/generaltranslation/gt/commit/43c6a76be3d3be420e892b86188ef41c45ae8ffe) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Refactored useGT and useMessages in order to make useMessages function like an unlintable useGT

- Updated dependencies [[`43c6a76`](https://github.com/generaltranslation/gt/commit/43c6a76be3d3be420e892b86188ef41c45ae8ffe)]:
  - gt-react@10.4.1

## 6.3.0

### Minor Changes

- [#599](https://github.com/generaltranslation/gt/pull/599) [`5950592`](https://github.com/generaltranslation/gt/commit/5950592ca44197915216ec5c8e26f9714cb4f55c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: msg() function

### Patch Changes

- Updated dependencies [[`5950592`](https://github.com/generaltranslation/gt/commit/5950592ca44197915216ec5c8e26f9714cb4f55c)]:
  - gt-react@10.4.0

## 6.2.5

### Patch Changes

- [#597](https://github.com/generaltranslation/gt/pull/597) [`e72c888`](https://github.com/generaltranslation/gt/commit/e72c888d70ef5ab521f1d1bc79f81f962b7431a3) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: disable compiler for apple

## 6.2.4

### Patch Changes

- [#592](https://github.com/generaltranslation/gt/pull/592) [`753ac31`](https://github.com/generaltranslation/gt/commit/753ac31930f9184e81da172fac0ee155302b9512) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Fixed resolution error for plugin under different build tools

## 6.2.3

### Patch Changes

- [#583](https://github.com/generaltranslation/gt/pull/583) [`e0b92f4`](https://github.com/generaltranslation/gt/commit/e0b92f42234f4f8fbb9859508769b6ee973407f8) Thanks [@brian-lou](https://github.com/brian-lou)! - Bump core library version

- Updated dependencies [[`9b05fda`](https://github.com/generaltranslation/gt/commit/9b05fda9959f9e24491c02f357bc2a2c49ba0276), [`e0b92f4`](https://github.com/generaltranslation/gt/commit/e0b92f42234f4f8fbb9859508769b6ee973407f8)]:
  - generaltranslation@7.4.1
  - gt-react@10.3.1

## 6.2.2

### Patch Changes

- [#572](https://github.com/generaltranslation/gt/pull/572) [`4e95824`](https://github.com/generaltranslation/gt/commit/4e958249a759eb531d053a38764f0a51e0284c73) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: turbopack relative import for plugin

## 6.2.1

### Patch Changes

- [#570](https://github.com/generaltranslation/gt/pull/570) [`9f49d8c`](https://github.com/generaltranslation/gt/commit/9f49d8ca2af6f2373a0e83080100b7d0d8dc5a38) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: throwing error on template string

## 6.2.0

### Minor Changes

- [#536](https://github.com/generaltranslation/gt/pull/536) [`468b0b7`](https://github.com/generaltranslation/gt/commit/468b0b7c660fd1ab9e8c2611a26ade63ba268e80) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Added locale selection based on region
  Added compile time hashing
  Added es lint plugin for gt-next (in alpha)
  Fix CLI validation (used to error for {<JSX/>} inside <T>)

### Patch Changes

- Updated dependencies [[`468b0b7`](https://github.com/generaltranslation/gt/commit/468b0b7c660fd1ab9e8c2611a26ade63ba268e80)]:
  - gt-react@10.3.0
  - generaltranslation@7.4.0

## 6.1.2

### Patch Changes

- [#559](https://github.com/generaltranslation/gt/pull/559) [`5b93faf`](https://github.com/generaltranslation/gt/commit/5b93faf28001c579e293d027651889be44ea366e) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added useLocaleDirection hook and async getLocaleDirection function

- Updated dependencies [[`5b93faf`](https://github.com/generaltranslation/gt/commit/5b93faf28001c579e293d027651889be44ea366e)]:
  - gt-react@10.2.1

## 6.1.1

### Patch Changes

- [#550](https://github.com/generaltranslation/gt/pull/550) [`b83d72e`](https://github.com/generaltranslation/gt/commit/b83d72e1d932a8f63157280d9d9dc6c451f2a625) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added a cookie to track region

- Updated dependencies [[`b83d72e`](https://github.com/generaltranslation/gt/commit/b83d72e1d932a8f63157280d9d9dc6c451f2a625)]:
  - gt-react@10.1.1

## 6.1.0

### Minor Changes

- [#547](https://github.com/generaltranslation/gt/pull/547) [`4806575`](https://github.com/generaltranslation/gt/commit/4806575a7b01184ea35a55fb07fe241144205e4a) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added locale selection based on region

### Patch Changes

- Updated dependencies [[`4806575`](https://github.com/generaltranslation/gt/commit/4806575a7b01184ea35a55fb07fe241144205e4a)]:
  - gt-react@10.1.0
  - generaltranslation@7.2.0

## 6.0.11

### Patch Changes

- [#537](https://github.com/generaltranslation/gt/pull/537) [`2c690df`](https://github.com/generaltranslation/gt/commit/2c690dfcd47498133c8be2235da342ae684f7663) Thanks [@SamEggert](https://github.com/SamEggert)! - Update branch prop type to accept strings, numbers, and booleans

- Updated dependencies [[`2c690df`](https://github.com/generaltranslation/gt/commit/2c690dfcd47498133c8be2235da342ae684f7663)]:
  - gt-react@10.0.9

## 6.0.10

### Patch Changes

- [#529](https://github.com/generaltranslation/gt/pull/529) [`c77c83d`](https://github.com/generaltranslation/gt/commit/c77c83d33237c72ef13c6b6762b99ba150773de1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: use gt client side

- Updated dependencies [[`c77c83d`](https://github.com/generaltranslation/gt/commit/c77c83d33237c72ef13c6b6762b99ba150773de1)]:
  - gt-react@10.0.8

## 6.0.9

### Patch Changes

- [#518](https://github.com/generaltranslation/gt/pull/518) [`65b8f27`](https://github.com/generaltranslation/gt/commit/65b8f271746204dfa431367adad25f4cc0c0b4fd) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: clientside nested use translation

- Updated dependencies [[`65b8f27`](https://github.com/generaltranslation/gt/commit/65b8f271746204dfa431367adad25f4cc0c0b4fd)]:
  - gt-react@10.0.7

## 6.0.8

### Patch Changes

- [#508](https://github.com/generaltranslation/gt/pull/508) [`5375e2c`](https://github.com/generaltranslation/gt/commit/5375e2c1b17fba3ca52291e7d79f8d78a585ed49) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add zh-Hans and zh-Hant

- Updated dependencies [[`5375e2c`](https://github.com/generaltranslation/gt/commit/5375e2c1b17fba3ca52291e7d79f8d78a585ed49)]:
  - @generaltranslation/supported-locales@2.0.13
  - gt-react@10.0.6

## 6.0.7

### Patch Changes

- [#487](https://github.com/generaltranslation/gt/pull/487) [`984cf09`](https://github.com/generaltranslation/gt/commit/984cf098fea9d42f5619e95b78ad289c32e3b4d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: metadata field

- Updated dependencies [[`984cf09`](https://github.com/generaltranslation/gt/commit/984cf098fea9d42f5619e95b78ad289c32e3b4d2)]:
  - generaltranslation@7.1.1
  - gt-react@10.0.5

## 6.0.6

### Patch Changes

- [#444](https://github.com/generaltranslation/gt/pull/444) [`c206a11`](https://github.com/generaltranslation/gt/commit/c206a1158516a0d815b1570d77e6dd62acdcedc4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add translation interface for generaltranslation

- Updated dependencies [[`c206a11`](https://github.com/generaltranslation/gt/commit/c206a1158516a0d815b1570d77e6dd62acdcedc4)]:
  - generaltranslation@7.1.0
  - gt-react@10.0.4

## 6.0.5

### Patch Changes

- [#473](https://github.com/generaltranslation/gt/pull/473) [`398cbd9`](https://github.com/generaltranslation/gt/commit/398cbd972593a6579198cc143ce6c5b9d4fcc322) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: support for deprecation of experiemental config for turbo and resolving non default exports for loadTranslations() and loadDictionary()

## 6.0.4

### Patch Changes

- [#477](https://github.com/generaltranslation/gt/pull/477) [`26c6e2c`](https://github.com/generaltranslation/gt/commit/26c6e2ced7c8f8df7b1efa50a56ceb4d6e7f47bc) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: variable components returning null when passed children that were falsey

- Updated dependencies [[`26c6e2c`](https://github.com/generaltranslation/gt/commit/26c6e2ced7c8f8df7b1efa50a56ceb4d6e7f47bc)]:
  - gt-react@10.0.3

## 6.0.3

### Patch Changes

- [#474](https://github.com/generaltranslation/gt/pull/474) [`7f0920d`](https://github.com/generaltranslation/gt/commit/7f0920d378dd077a4ca14910a16c3e38cfa77dae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: <T> functions stripping variables their options see: https://github.com/generaltranslation/gt/issues/472

- Updated dependencies [[`7f0920d`](https://github.com/generaltranslation/gt/commit/7f0920d378dd077a4ca14910a16c3e38cfa77dae)]:
  - gt-react@10.0.2

## 6.0.2

### Patch Changes

- [#455](https://github.com/generaltranslation/gt/pull/455) [`1c6b822`](https://github.com/generaltranslation/gt/commit/1c6b82204a341dcfdb4fa8a58dc60ca7f68fda5d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: export inline translation options from root in gt-next

## 6.0.1

### Patch Changes

- [#440](https://github.com/generaltranslation/gt/pull/440) [`e6fdedf`](https://github.com/generaltranslation/gt/commit/e6fdedffcdfbac5d257ea35140cbb81de6aa2729) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fixes to breaking changes

- Updated dependencies [[`e6fdedf`](https://github.com/generaltranslation/gt/commit/e6fdedffcdfbac5d257ea35140cbb81de6aa2729)]:
  - generaltranslation@7.0.1
  - gt-react@10.0.1
  - @generaltranslation/supported-locales@2.0.12

## 6.0.0

### Major Changes

- [#436](https://github.com/generaltranslation/gt/pull/436) [`08377f3`](https://github.com/generaltranslation/gt/commit/08377f3b5b3b600efb1e232a7b9361e8c85ea4ae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Breaking changes

### Patch Changes

- Updated dependencies [[`08377f3`](https://github.com/generaltranslation/gt/commit/08377f3b5b3b600efb1e232a7b9361e8c85ea4ae)]:
  - gt-react@10.0.0
  - generaltranslation@7.0.0
  - @generaltranslation/supported-locales@2.0.11

## 5.2.39

### Patch Changes

- [#412](https://github.com/generaltranslation/gt/pull/412) [`08b8c8c`](https://github.com/generaltranslation/gt/commit/08b8c8c8e6acd25f828633c46a8e6309369d8c03) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix improper use of getLocaleProperties callback

- Updated dependencies [[`08b8c8c`](https://github.com/generaltranslation/gt/commit/08b8c8c8e6acd25f828633c46a8e6309369d8c03)]:
  - gt-react@9.2.30

## 5.2.38

### Patch Changes

- [#355](https://github.com/generaltranslation/gt/pull/355) [`740a3d1`](https://github.com/generaltranslation/gt/commit/740a3d1ee565016375d05e5dbb6b7d81fe9294ec) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: add custom gt use hooks on server side components

- Updated dependencies [[`740a3d1`](https://github.com/generaltranslation/gt/commit/740a3d1ee565016375d05e5dbb6b7d81fe9294ec)]:
  - gt-react@9.2.28

## 5.2.37

### Patch Changes

- [#353](https://github.com/generaltranslation/gt/pull/353) [`de17003`](https://github.com/generaltranslation/gt/commit/de170039e51383c8c8f3f59d5d94e93e6ccedeb9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: bump versions

- Updated dependencies [[`de17003`](https://github.com/generaltranslation/gt/commit/de170039e51383c8c8f3f59d5d94e93e6ccedeb9)]:
  - gt-react@9.2.27

## 5.2.36

### Patch Changes

- [#348](https://github.com/generaltranslation/gt/pull/348) [`c43bd6d`](https://github.com/generaltranslation/gt/commit/c43bd6df7dd106723e8dc173b6c0d65009be461e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename useDict to useTranslations

- Updated dependencies [[`c43bd6d`](https://github.com/generaltranslation/gt/commit/c43bd6df7dd106723e8dc173b6c0d65009be461e)]:
  - gt-react@9.2.26

## 5.2.35

### Patch Changes

- [#346](https://github.com/generaltranslation/gt/pull/346) [`28b78a6`](https://github.com/generaltranslation/gt/commit/28b78a62de117cc8e4370cab79280495de37f28f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: switch to GT object

- Updated dependencies [[`28b78a6`](https://github.com/generaltranslation/gt/commit/28b78a62de117cc8e4370cab79280495de37f28f)]:
  - gt-react@9.2.25
  - generaltranslation@6.3.2

## 5.2.34

### Patch Changes

- [#342](https://github.com/generaltranslation/gt/pull/342) [`5e360c8`](https://github.com/generaltranslation/gt/commit/5e360c838ff831659dc2c9da800ec8f3271afb24) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enforce no support for custom getLocale function

## 5.2.33

### Patch Changes

- [#316](https://github.com/generaltranslation/gt/pull/316) [`274a88e`](https://github.com/generaltranslation/gt/commit/274a88e2ac2e4d60360bf950f56c4ee2850804fe) Thanks [@michellee-wang](https://github.com/michellee-wang)! - updated localeselector

- Updated dependencies [[`274a88e`](https://github.com/generaltranslation/gt/commit/274a88e2ac2e4d60360bf950f56c4ee2850804fe)]:
  - @generaltranslation/supported-locales@2.0.10
  - gt-react@9.2.24
  - generaltranslation@6.2.10

## 5.2.32

### Patch Changes

- [#322](https://github.com/generaltranslation/gt/pull/322) [`70e21bb`](https://github.com/generaltranslation/gt/commit/70e21bbdc0720c1ff8db3700d341b67a7fcd146e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Conditionally calcualte hashes for the server T component

## 5.2.31

### Patch Changes

- [#320](https://github.com/generaltranslation/gt/pull/320) [`95230f8`](https://github.com/generaltranslation/gt/commit/95230f84855021822ca774eec8432bdfaeeba0dc) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Export translation options as params

- Updated dependencies [[`95230f8`](https://github.com/generaltranslation/gt/commit/95230f84855021822ca774eec8432bdfaeeba0dc)]:
  - gt-react@9.2.23

## 5.2.30

### Patch Changes

- [#311](https://github.com/generaltranslation/gt/pull/311) [`d2bb9f5`](https://github.com/generaltranslation/gt/commit/d2bb9f5caa5b7366af3d3f8110a9f1586c9f58e7) Thanks [@michellee-wang](https://github.com/michellee-wang)! - added qbr and emojis + bumped verison

- Updated dependencies [[`d2bb9f5`](https://github.com/generaltranslation/gt/commit/d2bb9f5caa5b7366af3d3f8110a9f1586c9f58e7)]:
  - generaltranslation@6.2.9
  - gt-react@9.2.22
  - @generaltranslation/supported-locales@2.0.9

## 5.2.29

### Patch Changes

- [#305](https://github.com/generaltranslation/gt/pull/305) [`5991569`](https://github.com/generaltranslation/gt/commit/59915699154fa0b442c4460c7c8d586fdc8020f9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Bump downstream

- Updated dependencies [[`5991569`](https://github.com/generaltranslation/gt/commit/59915699154fa0b442c4460c7c8d586fdc8020f9)]:
  - generaltranslation@6.2.8
  - gt-react@9.2.21
  - @generaltranslation/supported-locales@2.0.8

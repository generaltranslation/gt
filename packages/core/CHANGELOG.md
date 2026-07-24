# generaltranslation

## 9.0.5

### Patch Changes

- [#1889](https://github.com/generaltranslation/gt/pull/1889) [`29cd6b8`](https://github.com/generaltranslation/gt/commit/29cd6b89f3587d3253cfadde6bec925d8697324b) Thanks [@bgub](https://github.com/bgub)! - Allow `awaitJobs()` to poll job IDs directly and reuse that shared polling implementation for CLI and Sanity project setup.

## 9.0.4

### Patch Changes

- [#1974](https://github.com/generaltranslation/gt/pull/1974) [`bbf4eb0`](https://github.com/generaltranslation/gt/commit/bbf4eb0cf77160baa615776619acd7afe35697ba) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add opt-in locale routing for TanStack Start. Setting `localeRouting` in `gt.config.json` makes `gtMiddleware` prioritize locale path prefixes and updates client locale changes to keep the pathname in sync while leaving the default locale unprefixed.

- [#1929](https://github.com/generaltranslation/gt/pull/1929) [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Replace the FormatJS ICU parser and runtime formatter dependencies with the new dependency-free `@generaltranslation/icu` package.

- Updated dependencies [[`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - @generaltranslation/icu@0.1.0
  - @generaltranslation/format@0.1.3

## 9.0.3

### Patch Changes

- [#1916](https://github.com/generaltranslation/gt/pull/1916) [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify `gt.config.json` types so complete config objects can be spread into compiler plugins and runtime initializers while file settings remain optional.

## 9.0.2

### Patch Changes

- [#1895](https://github.com/generaltranslation/gt/pull/1895) [`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Resolve custom source-locale aliases before uploading translation files.

- [#1897](https://github.com/generaltranslation/gt/pull/1897) [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow `setupProject` callers to pass only the branch, file, and version IDs that the API request uses.

- [#1896](https://github.com/generaltranslation/gt/pull/1896) [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Correct the shipped `checkJobStatus` example to pass the timeout as a number.

## 9.0.1

### Patch Changes

- [#1880](https://github.com/generaltranslation/gt/pull/1880) [`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Deprecate the `id` option in `hashSource` ahead of its removal in the next major version.

## 9.0.0

### Major Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

### Patch Changes

- [#1818](https://github.com/generaltranslation/gt/pull/1818) [`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a) Thanks [@bgub](https://github.com/bgub)! - Clean up the `generaltranslation` public API surface for the next major.

  Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.

- [#1809](https://github.com/generaltranslation/gt/pull/1809) [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for generaltranslation.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default exports from package entrypoints and internal source modules.

  Use named imports for affected public entrypoints, including `import { plugin } from 'gt-react-native/plugin'`. The `gt-next/link` entrypoint keeps its default export to match `next/link`.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Import the FormatJS `TYPE` runtime enum from the parser entrypoint so Vite dev does not request the CommonJS `types.js` subpath as a browser ESM module.

- [#1814](https://github.com/generaltranslation/gt/pull/1814) [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Vendor the FormatJS ICU AST printer so the ESM internal build no longer imports the CommonJS `printer.js` subpath, which Vite-based dev servers (e.g. TanStack Start) cannot load. Serialized output is byte-identical, so hashes are unchanged.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the v8-era backwards-compatibility shim from `generaltranslation`.

  Deletes `src/backwards-compatability/` (`dataConversion`, `oldTypes`, `typeChecking`, `oldHashJsxChildren`) and its 26 re-exports from `generaltranslation/internal` — the old↔new JSX/variable-format converters, legacy type guards, and the legacy hashers. These had no consumers anywhere in the libraries; the old format they bridged is no longer produced. Safe to drop in the next major. ~477 LOC removed from the `/internal` entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove the unused `hashTemplate` export from `generaltranslation/id`. It had no consumers anywhere in the libraries. `hashSource`/`hashString` are unchanged.

- Updated dependencies [[`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be)]:
  - @generaltranslation/format@0.1.2

## 9.0.0-odysseus.6

### Patch Changes

- b72c30b: Clean up the `generaltranslation` public API surface for the next major.

  Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.

- d5cf2d3: Vendor the FormatJS ICU AST printer so the ESM internal build no longer imports the CommonJS `printer.js` subpath, which Vite-based dev servers (e.g. TanStack Start) cannot load. Serialized output is byte-identical, so hashes are unchanged.

## 9.0.0-odysseus.5

### Patch Changes

- 72e9e16: Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.
- 5adeede: Trigger an odysseus prerelease patch for generaltranslation.
- 2e85ebd: Import the FormatJS `TYPE` runtime enum from the parser entrypoint so Vite dev does not request the CommonJS `types.js` subpath as a browser ESM module.

## 9.0.0-odysseus.4

### Patch Changes

- 26faa87: Remove the unused `hashTemplate` export from `generaltranslation/id`. It had no consumers anywhere in the libraries. `hashSource`/`hashString` are unchanged.

## 9.0.0-odysseus.3

### Patch Changes

- b1eef00: Remove the v8-era backwards-compatibility shim from `generaltranslation`.

  Deletes `src/backwards-compatability/` (`dataConversion`, `oldTypes`, `typeChecking`, `oldHashJsxChildren`) and its 26 re-exports from `generaltranslation/internal` — the old↔new JSX/variable-format converters, legacy type guards, and the legacy hashers. These had no consumers anywhere in the libraries; the old format they bridged is no longer produced. Safe to drop in the next major. ~477 LOC removed from the `/internal` entry.

## 9.0.0-odysseus.2

### Patch Changes

- [#1678](https://github.com/generaltranslation/gt/pull/1678) [`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

- [#1676](https://github.com/generaltranslation/gt/pull/1676) [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default exports from package entrypoints and internal source modules.

  Use named imports for affected public entrypoints, including `import { plugin } from 'gt-react-native/plugin'`. The `gt-next/link` entrypoint keeps its default export to match `next/link`.

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660)]:
  - @generaltranslation/format@0.1.2-odysseus.1

## 9.0.0-odysseus.1

### Patch Changes

- [#1677](https://github.com/generaltranslation/gt/pull/1677) [`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

## 9.0.0-odysseus.0

### Major Changes

- [#1627](https://github.com/generaltranslation/gt/pull/1627) [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065)]:
  - @generaltranslation/format@0.1.2-odysseus.0

## 8.2.18

### Patch Changes

- [#1648](https://github.com/generaltranslation/gt/pull/1648) [`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8) Thanks [@brian-lou](https://github.com/brian-lou)! - Use `gt-project-id` instead of `x-gt-project-id` for API request headers. Update the API key header to use standard `Authorization: Bearer <api-key>` prefix.

## 8.2.17

### Patch Changes

- [#1635](https://github.com/generaltranslation/gt/pull/1635) [`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01) Thanks [@brian-lou](https://github.com/brian-lou)! - Add retry mechanism for rate limits

## 8.2.16

### Patch Changes

- [#1460](https://github.com/generaltranslation/gt/pull/1460) [`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: escape characters in declareVar() for source locale consumed by condenseVars()

## 8.2.19

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

## 8.2.18

### Patch Changes

- [#1648](https://github.com/generaltranslation/gt/pull/1648) [`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8) Thanks [@brian-lou](https://github.com/brian-lou)! - Use `gt-project-id` instead of `x-gt-project-id` for API request headers. Update the API key header to use standard `Authorization: Bearer <api-key>` prefix.

## 8.2.17

### Patch Changes

- [#1635](https://github.com/generaltranslation/gt/pull/1635) [`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01) Thanks [@brian-lou](https://github.com/brian-lou)! - Add retry mechanism for rate limits

## 8.2.16

### Patch Changes

- [#1460](https://github.com/generaltranslation/gt/pull/1460) [`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: escape characters in declareVar() for source locale consumed by condenseVars()

## 8.2.15

### Patch Changes

- [#1416](https://github.com/generaltranslation/gt/pull/1416) [`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa) Thanks [@bgub](https://github.com/bgub)! - Honor custom locale region display-name overrides and simplify shared locale formatting helpers.

- [#1419](https://github.com/generaltranslation/gt/pull/1419) [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300) Thanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages and package-local diagnostic formatting.

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa)]:
  - @generaltranslation/format@0.1.1

## 8.2.14

### Patch Changes

- [#1397](https://github.com/generaltranslation/gt/pull/1397) [`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99) Thanks [@bgub](https://github.com/bgub)! - Extract locale and formatting primitives into the new `@generaltranslation/format` package and update `generaltranslation/core` to re-export the shared helpers.

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99)]:
  - @generaltranslation/format@0.1.0

## 8.2.13

### Patch Changes

- [#1379](https://github.com/generaltranslation/gt/pull/1379) [`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7) Thanks [@bgub](https://github.com/bgub)! - Tighten public and API metadata types, and handle metadata entries without hashes in the CLI.

- [#1387](https://github.com/generaltranslation/gt/pull/1387) [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796) Thanks [@bgub](https://github.com/bgub)! - Reduce explicit any usage in core and Next.js types.

## 8.2.12

### Patch Changes

- [#1364](https://github.com/generaltranslation/gt/pull/1364) [`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0) Thanks [@pie575](https://github.com/pie575)! - Update Derive docs comments

## 8.2.11

### Patch Changes

- [#1308](https://github.com/generaltranslation/gt/pull/1308) [`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6) Thanks [@bgub](https://github.com/bgub)! - Add shared cache expiry, batching, and runtime translation configuration to I18nManager.

## 8.2.10

### Patch Changes

- [#1276](https://github.com/generaltranslation/gt/pull/1276) [`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6) Thanks [@bgub](https://github.com/bgub)! - Fix locale emoji fallback handling for language exception locales and document supported flag regions.

## 8.2.9

### Patch Changes

- [#1278](https://github.com/generaltranslation/gt/pull/1278) [`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8) Thanks [@bgub](https://github.com/bgub)! - Add a `generaltranslation/core` entrypoint for locale and formatting helpers, and update `gt-i18n` to consume it where possible.

## 8.2.8

### Patch Changes

- [#1248](https://github.com/generaltranslation/gt/pull/1248) [`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add PO/POT file format support and transformFormat plumbing for API uploads and CLI file downloads.

## 8.2.7

### Patch Changes

- [#1246](https://github.com/generaltranslation/gt/pull/1246) [`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5) Thanks [@bgub](https://github.com/bgub)! - Migrate build tooling from Rollup to tsdown (Rolldown). No public API changes. Output filenames simplified (e.g. `index.cjs.min.cjs` → `index.cjs`), minification removed (consumers bundle with their own minifier).

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

## 8.2.6

### Patch Changes

- [#1240](https://github.com/generaltranslation/gt/pull/1240) [`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3) Thanks [@bgub](https://github.com/bgub)! - Replace crypto-js with @noble/hashes for SHA-256 hashing

## 8.2.5

### Patch Changes

- [#1218](https://github.com/generaltranslation/gt/pull/1218) [`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(react/browser): dev hot reload

## 8.2.4

### Patch Changes

- [#1214](https://github.com/generaltranslation/gt/pull/1214) [`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: bundle deps to support gt-tanstack-start

## 8.2.3

### Patch Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

## 8.2.2

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

## 8.2.1

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

## 8.2.0

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

- [#1160](https://github.com/generaltranslation/gt/pull/1160) [`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding translation tagging

## 8.1.23

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

## 8.1.22

### Patch Changes

- [#1145](https://github.com/generaltranslation/gt/pull/1145) [`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add string datatype formatting

## 8.1.21

### Patch Changes

- [#1142](https://github.com/generaltranslation/gt/pull/1142) [`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e) Thanks [@brian-lou](https://github.com/brian-lou)! - Add new helper awaitJobs() function

- [#1140](https://github.com/generaltranslation/gt/pull/1140) [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding staged status to `gt-lock.json`, adding `useLatestAvailableVersion` flag to core download

## 8.1.20

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

## 8.1.19

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

## 8.1.18

### Patch Changes

- [#1122](https://github.com/generaltranslation/gt/pull/1122) [`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding CDN publishing for all file types

## 8.1.17

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

## 8.1.16

### Patch Changes

- [#1099](https://github.com/generaltranslation/gt/pull/1099) [`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add twilio json support for cli

## 8.1.15

### Patch Changes

- [#1096](https://github.com/generaltranslation/gt/pull/1096) [`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: remove required branchId field for enqueue

## 8.1.14

### Patch Changes

- [#1085](https://github.com/generaltranslation/gt/pull/1085) [`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76) Thanks [@brian-lou](https://github.com/brian-lou)! - feat: Auth wizard supports both types of key creation

## 8.1.13

### Patch Changes

- [#1061](https://github.com/generaltranslation/gt/pull/1061) [`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: language direction browser compatibility

## 8.1.12

### Patch Changes

- [#1046](https://github.com/generaltranslation/gt/pull/1046) [`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d) Thanks [@brian-lou](https://github.com/brian-lou)! - Update /translate endpoint

## 8.1.11

### Patch Changes

- [#1034](https://github.com/generaltranslation/gt/pull/1034) [`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12) Thanks [@brian-lou](https://github.com/brian-lou)! - Modularize API logic; add retry for 5XX errors

## 8.1.10

### Patch Changes

- [#1024](https://github.com/generaltranslation/gt/pull/1024) [`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - added custom emoji for 419 region code

## 8.1.9

### Patch Changes

- [#989](https://github.com/generaltranslation/gt/pull/989) [`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: set up i18n base

## 8.1.8

### Patch Changes

- [#981](https://github.com/generaltranslation/gt/pull/981) [`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handling source file movement to persist existing translations instead of retranslating

## 8.1.7

### Patch Changes

- [#960](https://github.com/generaltranslation/gt/pull/960) [`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: upload shared id for static content

## 8.1.6

### Patch Changes

- [#950](https://github.com/generaltranslation/gt/pull/950) [`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: datefns format support base

## 8.1.5

### Patch Changes

- [#908](https://github.com/generaltranslation/gt/pull/908) [`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix timeout logic; Refactor upload command

## 8.1.4

### Patch Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

## 8.1.3

### Patch Changes

- [#883](https://github.com/generaltranslation/gt/pull/883) [`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Send file paths in translation metadata

## 8.1.2

### Patch Changes

- [#880](https://github.com/generaltranslation/gt/pull/880) [`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Hotfix: sending format metadata to the API during build time translation

## 8.1.1

### Patch Changes

- [#860](https://github.com/generaltranslation/gt/pull/860) [`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: support for max char

## 8.1.0

### Minor Changes

- [#872](https://github.com/generaltranslation/gt/pull/872) [`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: formatCutoff()

## 8.0.6

### Patch Changes

- [#857](https://github.com/generaltranslation/gt/pull/857) [`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: compatibility for maxChars

## 8.0.5

### Patch Changes

- [#833](https://github.com/generaltranslation/gt/pull/833) [`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678) Thanks [@brian-lou](https://github.com/brian-lou)! - Add txt file translation support

## 8.0.4

### Patch Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

## 8.0.3

### Patch Changes

- [#823](https://github.com/generaltranslation/gt/pull/823) [`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831) Thanks [@brian-lou](https://github.com/brian-lou)! - Deprecate old 'setup' command -> Use 'init' instead. New 'setup' command runs project setup

## 8.0.2

### Patch Changes

- [#815](https://github.com/generaltranslation/gt/pull/815) [`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915) Thanks [@brian-lou](https://github.com/brian-lou)! - Batch enqueue jobs

## 8.0.1

### Patch Changes

- [#801](https://github.com/generaltranslation/gt/pull/801) [`f98c504`](https://github.com/generaltranslation/gt/commit/f98c504f1e025024b3e1e5e16a0271e86ed095fa) Thanks [@SamEggert](https://github.com/SamEggert)! - make getRegionProperties not internal

## 8.0.0

### Major Changes

- [#791](https://github.com/generaltranslation/gt/pull/791) [`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719) Thanks [@brian-lou](https://github.com/brian-lou)! - Update Notes:
  https://generaltranslation.com/blog/generaltranslation_v8

  Please update the following packages to the latest version:
  - generaltranslation: `7.9.1` or later
  - gtx-cli: `2.4.15` or later
  - gt-sanity: `1.0.11` or later

  Older versions of these packages may not be compatible with the latest version of the General Translation API and may require updating.

## 7.9.1

### Patch Changes

- [#786](https://github.com/generaltranslation/gt/pull/786) [`3da05a1`](https://github.com/generaltranslation/gt/commit/3da05a12a37a62ace3c7e321aa2fed5a4af52ad9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: remove static

## 7.9.0

### Minor Changes

- [#784](https://github.com/generaltranslation/gt/pull/784) [`93881f1`](https://github.com/generaltranslation/gt/commit/93881f159455a9bbc13d14e7fec9befa60998ba3) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: support for <Static> component in core

## 7.8.0

### Minor Changes

- [#771](https://github.com/generaltranslation/gt/pull/771) [`7434c15`](https://github.com/generaltranslation/gt/commit/7434c1503c2a62bdb90d4058f903a56331276365) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add list formatting

## 7.7.3

### Patch Changes

- [#757](https://github.com/generaltranslation/gt/pull/757) [`7ba2e84`](https://github.com/generaltranslation/gt/commit/7ba2e8412b608aa3415f4865dc26adbbd3daa236) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Resolving canonical locales in setup job

## 7.7.2

### Patch Changes

- [#755](https://github.com/generaltranslation/gt/pull/755) [`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Passing project locales as part of translation setup process

## 7.7.1

### Patch Changes

- [#751](https://github.com/generaltranslation/gt/pull/751) [`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a) Thanks [@SamEggert](https://github.com/SamEggert)! - transform for yaml files -- retrieve file format in downloadFileBatch

## 7.7.0

### Minor Changes

- [#745](https://github.com/generaltranslation/gt/pull/745) [`5208937`](https://github.com/generaltranslation/gt/commit/520893719480b40774ccd749fe73727cf490f46c) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding local translation editing. Local user edits to translation will now be saved and used to inform future translations of the same file.

## 7.6.5

### Patch Changes

- [#737](https://github.com/generaltranslation/gt/pull/737) [`ed93e41`](https://github.com/generaltranslation/gt/commit/ed93e419e9547e6f2353d99f896702016f8ba751) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: buffer not available on browser for react

## 7.6.4

### Patch Changes

- [#698](https://github.com/generaltranslation/gt/pull/698) [`9eefc14`](https://github.com/generaltranslation/gt/commit/9eefc14577013fcfa699344c4a950c12d3b3350b) Thanks [@brian-lou](https://github.com/brian-lou)! - Switch monorepo package manager to pnpm (no new features or bugs fixed). Please report issues to https://github.com/generaltranslation/gt

## 7.6.3

### Patch Changes

- [#677](https://github.com/generaltranslation/gt/pull/677) [`73fb32f`](https://github.com/generaltranslation/gt/commit/73fb32fecc936530691c0f8ad3624a4c63852575) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix locale aliasing on some API functions

## 7.6.2

### Patch Changes

- [#660](https://github.com/generaltranslation/gt/pull/660) [`2ddff43`](https://github.com/generaltranslation/gt/commit/2ddff430817ad61e996b516c539b6b7b944e618e) Thanks [@brian-lou](https://github.com/brian-lou)! - Update API utility functions

## 7.6.1

### Patch Changes

- [#653](https://github.com/generaltranslation/gt/pull/653) [`55d3619`](https://github.com/generaltranslation/gt/commit/55d36190b8f61fff7ddcb3d9aecf1cd3474c420b) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding return type to file uploads

## 7.6.0

### Minor Changes

- [#651](https://github.com/generaltranslation/gt/pull/651) [`3e5705b`](https://github.com/generaltranslation/gt/commit/3e5705bc96005441798619fec97574fa15a5a2bd) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Split up file upload into source/translation specific uploads; added project setup visibility

## 7.5.0

### Minor Changes

- [#638](https://github.com/generaltranslation/gt/pull/638) [`16bf30d`](https://github.com/generaltranslation/gt/commit/16bf30d70a0599ec863305f4f7a5a0852dd07e5d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add locale aliasing

## 7.4.3

### Patch Changes

- [#626](https://github.com/generaltranslation/gt/pull/626) [`de93e08`](https://github.com/generaltranslation/gt/commit/de93e0824ebab1b9483739462027510498abfcfe) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add force flag

## 7.4.2

### Patch Changes

- [#623](https://github.com/generaltranslation/gt/pull/623) [`288d2c6`](https://github.com/generaltranslation/gt/commit/288d2c657ff46eb5f4a5cdbc76ecc3f9be85228f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add --force flag for overwriting cached translations

## 7.4.1

### Patch Changes

- [#580](https://github.com/generaltranslation/gt/pull/580) [`9b05fda`](https://github.com/generaltranslation/gt/commit/9b05fda9959f9e24491c02f357bc2a2c49ba0276) Thanks [@brian-lou](https://github.com/brian-lou)! - Update API schema, combine files and JSX translation endpoints

## 7.4.0

### Minor Changes

- [#536](https://github.com/generaltranslation/gt/pull/536) [`468b0b7`](https://github.com/generaltranslation/gt/commit/468b0b7c660fd1ab9e8c2611a26ade63ba268e80) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Added locale selection based on region
  Added compile time hashing
  Added es lint plugin for gt-next (in alpha)
  Fix CLI validation (used to error for {<JSX/>} inside <T>)

## 7.3.0

### Minor Changes

- [#556](https://github.com/generaltranslation/gt/pull/556) [`c52d896`](https://github.com/generaltranslation/gt/commit/c52d896f83fb4f6e58921286320a524885c8a52d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding modelProvider field to gt.config

## 7.2.0

### Minor Changes

- [#547](https://github.com/generaltranslation/gt/pull/547) [`4806575`](https://github.com/generaltranslation/gt/commit/4806575a7b01184ea35a55fb07fe241144205e4a) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added locale selection based on region

## 7.1.6

### Patch Changes

- [#544](https://github.com/generaltranslation/gt/pull/544) [`ca7d1ac`](https://github.com/generaltranslation/gt/commit/ca7d1ac0d424f9804031020e3a36bae27bdcc049) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - corrected nameWithRegionCode and nativeNameWithRegion code

## 7.1.5

### Patch Changes

- [#531](https://github.com/generaltranslation/gt/pull/531) [`46fb40d`](https://github.com/generaltranslation/gt/commit/46fb40d5e76898c7cbf7dc02d7b62de5ad64a95f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: deprecate \_translate for translate in core

## 7.1.4

### Patch Changes

- [#495](https://github.com/generaltranslation/gt/pull/495) [`a7eca74`](https://github.com/generaltranslation/gt/commit/a7eca74677356b392c7c1a431f664c8e28adbf0c) Thanks [@brian-lou](https://github.com/brian-lou)! - Add support for translating arbitrary JSON files (all strings). Add support for partially translating JSON files via jsonSchema config setting. Add support for composite JSON files (where there is a single JSON containing data for all translated languages). Add support for preset jsonSchemas.

## 7.1.3

### Patch Changes

- [#493](https://github.com/generaltranslation/gt/pull/493) [`b922f0f`](https://github.com/generaltranslation/gt/commit/b922f0f955e616d53d0964b420191a0f8c07a343) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: backwards compatability

## 7.1.2

### Patch Changes

- [#490](https://github.com/generaltranslation/gt/pull/490) [`03b3367`](https://github.com/generaltranslation/gt/commit/03b3367e98b155a21a723f0a645999f3efb40d18) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add internal header when necessary

## 7.1.1

### Patch Changes

- [#487](https://github.com/generaltranslation/gt/pull/487) [`984cf09`](https://github.com/generaltranslation/gt/commit/984cf098fea9d42f5619e95b78ad289c32e3b4d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: metadata field

## 7.1.0

### Minor Changes

- [#444](https://github.com/generaltranslation/gt/pull/444) [`c206a11`](https://github.com/generaltranslation/gt/commit/c206a1158516a0d815b1570d77e6dd62acdcedc4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add translation interface for generaltranslation

## 7.0.1

### Patch Changes

- [#440](https://github.com/generaltranslation/gt/pull/440) [`e6fdedf`](https://github.com/generaltranslation/gt/commit/e6fdedffcdfbac5d257ea35140cbb81de6aa2729) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fixes to breaking changes

## 7.0.0

### Major Changes

- [#436](https://github.com/generaltranslation/gt/pull/436) [`08377f3`](https://github.com/generaltranslation/gt/commit/08377f3b5b3b600efb1e232a7b9361e8c85ea4ae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Breaking changes

## 6.3.2

### Patch Changes

- [#346](https://github.com/generaltranslation/gt/pull/346) [`28b78a6`](https://github.com/generaltranslation/gt/commit/28b78a62de117cc8e4370cab79280495de37f28f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: switch to GT object

## 6.3.1

### Patch Changes

- [#340](https://github.com/generaltranslation/gt/pull/340) [`df5d5db`](https://github.com/generaltranslation/gt/commit/df5d5dbb25e2031891fc425e1e04f9022e935f00) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Exported LocaleProperties type in generaltranslation/types

## 6.3.0

### Minor Changes

- [#334](https://github.com/generaltranslation/gt/pull/334) [`f08ebb9`](https://github.com/generaltranslation/gt/commit/f08ebb92680c6158dd75ea1089924e74a8731774) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added custom mapping in the GT driver

### Patch Changes

- [#334](https://github.com/generaltranslation/gt/pull/334) [`f08ebb9`](https://github.com/generaltranslation/gt/commit/f08ebb92680c6158dd75ea1089924e74a8731774) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - fix error that was introduced during testing

## 6.2.10

### Patch Changes

- [#316](https://github.com/generaltranslation/gt/pull/316) [`274a88e`](https://github.com/generaltranslation/gt/commit/274a88e2ac2e4d60360bf950f56c4ee2850804fe) Thanks [@michellee-wang](https://github.com/michellee-wang)! - updated localeselector

## 6.2.9

### Patch Changes

- [#311](https://github.com/generaltranslation/gt/pull/311) [`d2bb9f5`](https://github.com/generaltranslation/gt/commit/d2bb9f5caa5b7366af3d3f8110a9f1586c9f58e7) Thanks [@michellee-wang](https://github.com/michellee-wang)! - added qbr and emojis + bumped verison

## 6.2.8

### Patch Changes

- [#305](https://github.com/generaltranslation/gt/pull/305) [`5991569`](https://github.com/generaltranslation/gt/commit/59915699154fa0b442c4460c7c8d586fdc8020f9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Bump downstream

## 6.2.7

### Patch Changes

- [#300](https://github.com/generaltranslation/gt/pull/300) [`6d98de0`](https://github.com/generaltranslation/gt/commit/6d98de0b0b0b56e58bf69dac96380eac2f1122b1) Thanks [@brian-lou](https://github.com/brian-lou)! - Re-release core package

## 6.2.6

### Patch Changes

- [#296](https://github.com/generaltranslation/gt/pull/296) [`a558260`](https://github.com/generaltranslation/gt/commit/a55826006f69c0e9869f687c065de7ad1e2828a6) Thanks [@brian-lou](https://github.com/brian-lou)! - Test with new package.json

## 6.2.5

### Patch Changes

- [#294](https://github.com/generaltranslation/gt/pull/294) [`a3303d7`](https://github.com/generaltranslation/gt/commit/a3303d7a7ccfc39ddbdd7edd51a2689da1c6ded0) Thanks [@brian-lou](https://github.com/brian-lou)! - Modify core to support custom locales

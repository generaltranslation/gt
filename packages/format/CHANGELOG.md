# @generaltranslation/format

## 0.1.9

### Patch Changes

- [#2288](https://github.com/generaltranslation/gt/pull/2288) [`90109bf`](https://github.com/generaltranslation/gt/commit/90109bf9ec4900819023176320629a5069fd7b51) Thanks [@eoinest](https://github.com/eoinest)! - Preserve configured locale identities across negotiation, routing, hooks, cookies, translation loaders, and caches, including when GT services are enabled. For example, configuring `en-gb` keeps that spelling in application-facing values while GT service requests and formatting use `en-GB`.

  Locale negotiation accepts equivalent spellings and returns a configured identity, preserving exact matches between distinct aliases for the same language. This also applies to request-header negotiation: an `Accept-Language` preference of `fr` can resolve to a configured `brand-french` alias. Preserve support for legacy tags such as `sh` and `cnr`, and retain existing custom mappings when validating partial `setConfig()` updates.

  Translation loaders and local filenames must use the configured identity: a loader for configured `en-gb` receives `en-gb`, not `en-GB`. Configure canonical spelling instead if the application requires it. Custom mapping `code` values must use canonical spelling, for example `'en-gb': { code: 'en-GB' }`. Canonicalize locales at GT service boundaries, including nested source-file locales in translation uploads and requests through the shared CLI/Sanity adapter. Require canonical locale codes or explicit custom mappings for CLI commands that use GT translation services. For example, using `en-us` with the API requires `customMapping: { "en-us": { "code": "en-US" } }`; otherwise the command exits with guidance before running the translation workflow. Local-only commands and dry runs retain their existing validation. Restore configured identities in service metadata; without a corresponding requested identity, use the first matching configured locale.

  Align server/browser locale values and expose the configured locale list through `useLocales()`. In Next.js, preserve configured identities in localized paths, route overrides, and locale availability. Resolve unsupported locale preferences before deciding whether to prefix the default locale, and cache locale resolution during middleware initialization.

  For Next.js App Router, read locale and region from server-provided conditions. Setters write request cookies and retain pending values for the refresh callback; hooks keep reading the current server conditions until a new snapshot arrives, including when a locale switch is rejected. Use `router.refresh()` on Next.js 16.1 and newer and a document reload on older versions to avoid stale layout/provider snapshots after middleware redirects. Detect this capability at build time, retain the existing document reload when returning to the default locale, and leave other React integrations' cookie-backed behavior unchanged. This adds no request-time cookie reads and does not change App Router's existing `enableI18n` behavior.

## 0.1.8

### Patch Changes

- [#2068](https://github.com/generaltranslation/gt/pull/2068) [`f2204b9`](https://github.com/generaltranslation/gt/commit/f2204b990278865c54d14d337392930ea1ec31bf) Thanks [@eoinest](https://github.com/eoinest)! - Represent React's persisted boolean and null rich-content values in the shared
  JSX wire types used by framework runtimes and translation catalogs.

## 0.1.5-iris.0

### Patch Changes

- f2204b9: Represent React's persisted boolean and null rich-content values in the shared
  JSX wire types used by framework runtimes and translation catalogs.
- 5d8b78a: Migrate the package license from FSL-1.1-ALv2 to MIT.
- Updated dependencies [5d8b78a]
  - @generaltranslation/icu@0.1.2-iris.0

## 0.1.7

### Patch Changes

- [#2109](https://github.com/generaltranslation/gt/pull/2109) [`bb08d8c`](https://github.com/generaltranslation/gt/commit/bb08d8cc5df87c71dd2a31416087821dbae38aa8) Thanks [@eoinest](https://github.com/eoinest)! - Reuse the prepared configured-locale scope when deciding whether a locale requires translation.

## 0.1.6

### Patch Changes

- [#2108](https://github.com/generaltranslation/gt/pull/2108) [`d0ae632`](https://github.com/generaltranslation/gt/commit/d0ae632ac0cd53600f6b893c23754dde06fbe808) Thanks [@eoinest](https://github.com/eoinest)! - Prepare and reuse an indexed configured-locale scope when determining the best supported locale.

## 0.1.5

### Patch Changes

- [#2074](https://github.com/generaltranslation/gt/pull/2074) [`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8) Thanks [@eoinest](https://github.com/eoinest)! - Migrate the package license from FSL-1.1-ALv2 to MIT.

- Updated dependencies [[`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8)]:
  - @generaltranslation/icu@0.1.2

## 0.1.4

### Patch Changes

- Updated dependencies [[`e55aaa9`](https://github.com/generaltranslation/gt/commit/e55aaa9cfdf6dfe3ab96d0eea927f255b66cd20d)]:
  - @generaltranslation/icu@0.1.1

## 0.1.3

### Patch Changes

- [#1929](https://github.com/generaltranslation/gt/pull/1929) [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Replace the FormatJS ICU parser and runtime formatter dependencies with the new dependency-free `@generaltranslation/icu` package.

- Updated dependencies [[`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - @generaltranslation/icu@0.1.0

## 0.1.2

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an Odysseus patch release for format utilities.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

## 0.1.2-odysseus.1

### Patch Changes

- [#1678](https://github.com/generaltranslation/gt/pull/1678) [`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

## 0.1.2-odysseus.0

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1628](https://github.com/generaltranslation/gt/pull/1628) [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an Odysseus patch release for format utilities.

## 0.1.1

### Patch Changes

- [#1416](https://github.com/generaltranslation/gt/pull/1416) [`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa) Thanks [@bgub](https://github.com/bgub)! - Honor custom locale region display-name overrides and simplify shared locale formatting helpers.

## 0.1.0

### Minor Changes

- [#1397](https://github.com/generaltranslation/gt/pull/1397) [`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99) Thanks [@bgub](https://github.com/bgub)! - Extract locale and formatting primitives into the new `@generaltranslation/format` package and update `generaltranslation/core` to re-export the shared helpers.

## 0.0.1

### Minor Changes

- Initial locale and formatting primitives package.

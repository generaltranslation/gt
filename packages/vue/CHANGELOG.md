# gt-vue

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.1.9
  - gt-i18n@1.0.19

## 0.1.2

### Patch Changes

- Updated dependencies [[`34845f9`](https://github.com/generaltranslation/gt/commit/34845f92d64fd9c94a712e4710e8958022066b7b)]:
  - generaltranslation@9.1.8
  - gt-i18n@1.0.18

## 0.1.1

### Patch Changes

- [#2130](https://github.com/generaltranslation/gt/pull/2130) [`b25c1d8`](https://github.com/generaltranslation/gt/commit/b25c1d87def728352d3dc089d954ef48bb3bd40e) Thanks [@eoinest](https://github.com/eoinest)! - Support custom locale mappings in request-scoped `createGT()` plugins.

## 0.1.0

### Minor Changes

- [#2012](https://github.com/generaltranslation/gt/pull/2012) [`8d376e2`](https://github.com/generaltranslation/gt/commit/8d376e23c80828dfd8756e2f0fbf0f7725e0f178) Thanks [@eoinest](https://github.com/eoinest)! - Add a lightweight Vue 3 runtime with catalog-backed string and rich-content
  translation, cookie-backed reactive locale switching, child-only variables,
  and typed value props for number, currency, and date formatting. Browser SPAs
  restore the locale from a configurable cookie, while an explicit server locale
  wins during SSR hydration.

### Patch Changes

- [#2068](https://github.com/generaltranslation/gt/pull/2068) [`f2204b9`](https://github.com/generaltranslation/gt/commit/f2204b990278865c54d14d337392930ea1ec31bf) Thanks [@eoinest](https://github.com/eoinest)! - Translate statically authored custom-component default slots, preserve authored
  Fragments, and align Branch and Plural wire values, rendering fallbacks, and
  locale selection with React. Add React-compatible `context`, `id`, `maxChars`,
  and `requiresReview` metadata to `<T>`, including compiler-facing `$` aliases.

- [#2080](https://github.com/generaltranslation/gt/pull/2080) [`5d8b78a`](https://github.com/generaltranslation/gt/commit/5d8b78a1085d5dadc5bdc7435b3c6addf8981c38) Thanks [@eoinest](https://github.com/eoinest)! - Migrate the package license from FSL-1.1-ALv2 to MIT.

- [#2090](https://github.com/generaltranslation/gt/pull/2090) [`95b48df`](https://github.com/generaltranslation/gt/commit/95b48df677d27f41a336f13e01ae7aa9aa484c73) Thanks [@eoinest](https://github.com/eoinest)! - Add browser SPA initialization and synchronous module-level `t()` translations
  to gt-vue.
- Updated dependencies [[`f2204b9`](https://github.com/generaltranslation/gt/commit/f2204b990278865c54d14d337392930ea1ec31bf), [`b05b470`](https://github.com/generaltranslation/gt/commit/b05b4703fbbfd34a3cbee335c786e2e606346167), [`8d376e2`](https://github.com/generaltranslation/gt/commit/8d376e23c80828dfd8756e2f0fbf0f7725e0f178)]:
  - @generaltranslation/format@0.1.8
  - generaltranslation@9.1.7
  - gt-i18n@1.0.17

## 0.1.0-iris.2

### Patch Changes

- 95b48df: Add browser SPA initialization and synchronous module-level `t()` translations
  to gt-vue.

## 0.1.0-iris.1

### Patch Changes

- f2204b9: Translate statically authored custom-component default slots, preserve authored
  Fragments, and align Branch and Plural wire values, rendering fallbacks, and
  locale selection with React. Add React-compatible `context`, `id`, `maxChars`,
  and `requiresReview` metadata to `<T>`, including compiler-facing `$` aliases.
- 5d8b78a: Migrate the package license from FSL-1.1-ALv2 to MIT.
- Updated dependencies [f2204b9]
- Updated dependencies [b05b470]
- Updated dependencies [5d8b78a]
  - generaltranslation@9.1.3-iris.0
  - gt-i18n@1.0.13-iris.0

## 0.1.0-iris.0

### Minor Changes

- 8d376e2: Add a lightweight Vue 3 runtime with catalog-backed string and rich-content
  translation, cookie-backed reactive locale switching, child-only variables,
  and typed value props for number, currency, and date formatting. Browser SPAs
  restore the locale from a configurable cookie, while an explicit server locale
  wins during SSR hydration.

### Patch Changes

- Updated dependencies [8d376e2]
  - gt-i18n@1.0.12-iris.0

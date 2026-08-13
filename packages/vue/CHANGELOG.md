# gt-vue

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

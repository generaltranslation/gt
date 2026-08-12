# Script extraction parity matrix

The Vue script tests port the React extractor's applicable adversarial cases:

- named, aliased, namespace, CommonJS, and TypeScript import-equals imports;
- deep callback aliases, lexical shadowing, reassignment safety, and static
  assignment/destructuring flows;
- direct, optional, non-null, and TypeScript-wrapped calls;
- static identifiers, concatenations, template expressions, bigint values,
  `as const`, and `satisfies` wrappers;
- Composition API bindings plus Options API `setup` returns, object spreads,
  concise arrows, component registration, and `defineComponent` aliases;
- shared `<script>`/`<script setup>` imports and Vue's digit tag
  normalization;
- Vue JSX/TSX `<T>` trees, namespace members such as `<GT.T>`, runtime-accurate
  Vue Fragment spellings, local ESM re-exports, and statically traceable local
  callback forwarding. Every authored JSX Fragment preserves the same semantic
  boundary as React.Fragment. Direct and nested array expressions preserve
  React's array cardinality, while boolean and null array members follow
  React.Children normalization.

The initial `gt-vue` API intentionally does not port React-only behavior:

- rich/ICU string interpolation and derived runtime placeholders;
- formatting metadata. Rich `<T>` sources support static `context`, `id`,
  `maxChars`, and `requiresReview` props, including their `$`-prefixed aliases;
- `getGT`, async translator creation, tagged templates, or React JSX semantics;
- extraction through arbitrary runtime callbacks, package re-exports, or
  cross-file data flow beyond statically resolved local ESM modules. When a
  callback or conditional value can still be a translator but cannot be
  resolved safely, extraction fails closed instead of silently omitting a
  catalog entry.

Unsupported dynamic `gt()`/`msg()`/`t()` content receives an extraction
diagnostic. Dynamic `useMessages()` input remains unreported because it may be
an encoded value produced by `msg()` at runtime.

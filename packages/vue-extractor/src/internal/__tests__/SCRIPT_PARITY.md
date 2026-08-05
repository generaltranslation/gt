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
  normalization.

The initial `gt-vue` API intentionally does not port React-only behavior:

- rich/ICU string interpolation and derived runtime placeholders;
- metadata other than `$context`, including `$id`, `$maxChars`, and formatting;
- `getGT`, async translator creation, tagged templates, or React JSX extraction;
- extraction through arbitrary callbacks or cross-file data flow. When a
  local callback or conditional value can still be a translator, extraction
  fails closed instead of silently omitting a catalog entry.

Unsupported dynamic `gt()`/`msg()` content receives an extraction diagnostic.
Dynamic `useMessages()` input remains unreported because it may be an encoded
value produced by `msg()` at runtime.

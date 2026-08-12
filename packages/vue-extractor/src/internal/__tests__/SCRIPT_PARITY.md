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
  cross-file data flow beyond statically resolved local ESM modules;
- module-level `t()` identities selected through dynamic callee expressions or
  runtime containers. Use a direct import or a statically resolved immutable
  alias when the call must be extracted.

Unsupported dynamic content or options in a statically resolved
`gt()`/`msg()`/`t()` call receives an extraction diagnostic. Dynamic
`useMessages()` input remains unreported because it may be an encoded value
produced by `msg()` at runtime.

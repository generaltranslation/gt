---
"gt-i18n": minor
"gt-next": minor
"gt-node": minor
---

Add a tagged `tx` for runtime translation: `` await tx`Hello, ${{ name }}!` `` or `` await tx({ context: 'button' })`Save` ``. It builds and hashes the message tree like `getGT()`, sends a missing translation for runtime translation and waits for it, then renders through the same path, so validation, fallbacks, and warnings match. It renders the source when i18n is disabled or the locale needs no translation. Like other runtime lookups, a failed request renders the source in production and throws in development. `gt-next/server` exports `tx` for the request locale, and `gt-node` exports `tx` for the current `withGT()` locale. Framework packages build it with `createTx()` from `gt-i18n/internal`, which also exports a `tx` bound to the condition store. Both entries also export `dyn()` for text known only at runtime, such as a database value: `` await tx`${dyn(greeting)}, ${{ name }}!` `` translates the greeting with the sentence in one request, while `name` stays a variable. `dyn()` also works inside `part` branches of `tx` messages; `gt`, `t`, and `msg` reject it at the type level because they render from the catalog.

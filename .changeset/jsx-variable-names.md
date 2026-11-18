---
'generaltranslation': major
'@generaltranslation/format': major
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt': major
'@generaltranslation/compiler': major
'@generaltranslation/vue-extractor': major
'gt-rrweb': major
'gt-vue': minor
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
---

**Breaking:** a variable in the content of a `<T>` is found by its id, and has a name only when its author gave it one. A variable component without a `name` used to get a generated one, such as `_gt_cost_2`.

```diff
- { "i": 2, "k": "_gt_cost_2", "v": "c" }   // <Currency>
+ { "i": 2, "v": "c" }

  { "i": 3, "k": "price", "v": "c" }        // <Currency name="price">, unchanged
```

- `i` identifies a variable among its siblings, as it does an element. The runtimes match a translated variable to its value by `i`, so two variables with the same `name` no longer render the same value.
- `v`, the type, is always there, and is how a variable is told from an element. `Variable` in `@generaltranslation/format` is now `{ i: number; v: VariableType; k?: string }`.
- `k` is only a label for translators. An empty `name` counts as none, in every runtime and extractor.
- `hashSource` hashes a variable by its `v` and, when it has one, its `k`.

Every `<T>` that holds a `<Var>`, `<Num>`, `<Currency>`, `<DateTime>` or `<RelativeTime>` without a `name` gets a new hash. The runtimes, `gt`, the compiler, the Next.js SWC plugin and the Vue and Svelte extractors all write the new form, so upgrade them together, then run `gt translate` again. Translations stored under the old hashes are no longer found, and a translated variable needs its `i`: local translation files need their keys and variables updated or regenerated. A `<T>` whose variables all have a `name`, or that has no variables, keeps its hash.

gt-svelte's `_gtm` metadata no longer lists variable names.

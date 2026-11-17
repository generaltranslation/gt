---
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt': major
'@generaltranslation/compiler': major
'@generaltranslation/vue-extractor': major
'gt-vue': minor
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
---

A variable component without a `name` inside `<T>` is now named `_gt_<id>`, like an unnamed value in a `` t`…` `` message. The name no longer holds the type, which is in the variable's `v` field: `_gt_value_3`, `_gt_n_3`, `_gt_cost_3`, `_gt_date_3` and `_gt_time_3` are all `_gt_3`.

The name is part of the stored source and of what `hashSource` hashes, so every `<T>` that holds a `<Var>`, `<Num>`, `<Currency>`, `<DateTime>` or `<RelativeTime>` without a `name` gets a new hash. The runtimes, `gt`, the compiler, the Next.js SWC plugin and the Vue and Svelte extractors all write the new name, so upgrade them together, then run `gt translate` again. Translations stored under the old hashes are no longer found: local translation files need their keys and variable names updated or regenerated. Variables with a `name` and messages without variables keep their hashes.

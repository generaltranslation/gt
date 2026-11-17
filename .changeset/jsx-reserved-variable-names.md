---
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt': major
'@generaltranslation/compiler': major
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
---

A variable component inside `<T>` can no longer take a `name` that starts with `_gt_`, as in `<Var name="_gt_2">`. The prefix names variables without a `name`, so such a name could be the same as the generated name of another variable in the `<T>`, and a translation would then render one value in both places. A `` t`…` `` message already rejects these names.

`gt`, the compiler and the Svelte extractor report the name as an error. The React runtime throws in development and logs in production, where it keeps rendering. The Next.js SWC plugin logs an error and computes no hash for the `<T>`. Pick another name. Variables without a `name` are not affected, and gt-vue does not take a `name` on a variable component.

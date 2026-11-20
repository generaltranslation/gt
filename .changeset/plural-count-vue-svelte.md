---
'gt-vue': minor
'@generaltranslation/vue-extractor': minor
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
---

`<N />` in Vue and Svelte: the count of the `<Plural>` it is in, formatted as a number, as `#` is in ICU.

```svelte
<Plural n={count} one="One file"><N /> files</Plural>
```

Use it instead of `<Num>` for the count. A translation can then show the count in any branch: English `one` only covers 1, so "One file" has none, but Russian uses `one` for 21 and 31 too. `<N />` takes no props, and outside a `<Plural>` it renders nothing.

It is stored as a variable of the new type `#`, which the runtime fills from the plural's `n` wherever a translation puts it.

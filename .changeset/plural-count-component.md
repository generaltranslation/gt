---
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-next': minor
'gt-react-native': minor
'gt-tanstack-start': minor
'@generaltranslation/compiler': minor
'gt': minor
'generaltranslation': patch
'@generaltranslation/format': patch
---

`<N />` is the count of the `<Plural>` it is in, formatted as a number, as `#` is in ICU.

```tsx
<Plural n={count} one="One file">
  <N /> files
</Plural>
```

Use it instead of `<Num>{count}</Num>` for the count. A translation can then show the count in any branch: English `one` only covers 1, so "One file" has none, but Russian uses `one` for 21 and 31 too and renders "21 файл". `<N />` takes no props. With no `<Plural>` to give it a count, it is an error in development and renders nothing in production.

It is stored as a variable of the new type `#`, which the runtime fills from the plural's `n` wherever a translation puts it.

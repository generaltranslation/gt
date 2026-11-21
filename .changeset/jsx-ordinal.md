---
'generaltranslation': minor
'@generaltranslation/format': minor
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-react-native': minor
'gt-next': minor
'gt-tanstack-start': minor
'gt': minor
'@generaltranslation/compiler': minor
'@generaltranslation/vue-extractor': minor
'gt-vue': minor
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
'@generaltranslation/react-core-linter': minor
---

`<Ordinal>` is `<Plural>` for ordinals such as 1st, 2nd and 3rd: it picks among the locale's ordinal categories, where `<Plural>` picks among its plural categories.

```jsx
<Ordinal
  n={place}
  one={<><Num>{place}</Num>st</>}
  two={<><Num>{place}</Num>nd</>}
  few={<><Num>{place}</Num>rd</>}
>
  <Num>{place}</Num>th
</Ordinal>
```

In English this renders 1st, 2nd, 3rd, 4th, 11th, 21st and so on. Everything else is as in `<Plural>`: the category branches `zero`, `one`, `two`, `few` and `many`, exact branches such as `_1`, the children as the fallback, `<N />` for its count in React, and the same errors and warnings. A translation picks among its own branches with the target locale's ordinal rules: French has `one` and the fallback, and Welsh has all six categories.

`gt-react`, `gt-react-native`, `gt-next` and `gt-tanstack-start` export it wherever they export `<Plural>`. `gt-vue` and `gt-svelte` have the same component: `<Ordinal :n="place" one="1st" two="2nd">nth</Ordinal>` in Vue, and `<Ordinal {n} one="first" two="second">later</Ordinal>` in Svelte, with slots and snippets for the branches as in `<Plural>`.

`gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors read `<Ordinal>` as they read `<Plural>`: an `other` prop, slot or snippet and a spread attribute in translated content are errors. The `static-jsx` lint rule checks its branches as it checks those of `<Plural>`.

Stored content marks an ordinal plural with `t: 'o'` in an element's GT data, beside `'p'` for a plural and `'s'` for a select, so `GTProp['t']` from `@generaltranslation/format` is now `'s' | 'p' | 'o'`. An `<Ordinal>` hashes differently from a `<Plural>` with the same branches.

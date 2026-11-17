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
---

`<Plural>` takes an `ordinal` prop, the counterpart of `selectordinal()`: it picks among the locale's ordinal categories, as for 1st, 2nd and 3rd.

```jsx
<Plural
  n={place}
  ordinal
  one={<><Num>{place}</Num>st</>}
  two={<><Num>{place}</Num>nd</>}
  few={<><Num>{place}</Num>rd</>}
>
  <Num>{place}</Num>th
</Plural>
```

Exact branches such as `_1` and the children, the fallback, work as they do without `ordinal`. Write `ordinal` as a bare attribute or as `ordinal={true}`: `gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors read it from the source, so a value computed at runtime is not seen. Vue and Svelte take the same prop.

Stored content marks an ordinal plural with `t: 'o'` in an element's GT data, beside `'p'` for a plural and `'b'` for a branch, so `GTProp['t']` from `@generaltranslation/format` is now `'p' | 'o' | 'b'`. An ordinal plural hashes differently from a cardinal one with the same branches.

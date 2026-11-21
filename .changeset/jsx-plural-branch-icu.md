---
'generaltranslation': major
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
'@generaltranslation/react-core-linter': minor
'@generaltranslation/icu': patch
---

**Breaking:** `<Plural>` and `<Select>` now choose a branch the way `plural()` and `select()` do, in React, Vue and Svelte.

- **ICU plural selection.** `<Plural>` picks an exact branch first, then the locale's plural category for `n`, then its children. `zero`, `one` and `two` are plural categories, no longer the numbers 0, 1 and 2: in English `zero` never matches, and in Japanese neither does `one`. For an exact number write `_0`, `_1` and so on, the JSX spelling of ICU's `=0`: `<Plural n={count} _0="No items" one="1 item">Many items</Plural>`. Stored content and translations use the ICU key, `=0`.
- **No aliases.** The `singular`, `plural` and `dual` branches are removed: write `one`, the children and `two`. `PluralType` from `generaltranslation` no longer includes them.
- **The children are the fallback, and `other` is not a prop.** The children of a `<Plural>` or a `<Select>` are what `other` is in `plural()` and `select()`: the content for a value with no branch of its own. In Vue that is the default slot. `<Plural other="...">` no longer works, and `<Select other="...">`, which used to match only the value `"other"`, no longer does: write the content as the children. `gt`, the compiler and the Vue and Svelte extractors report an `other` prop, slot or snippet as an error. Stored content and translations hold the children under the ICU key `other`, with the other branches. `gt` and the compiler also warn about a `<Plural>` prop that looks like an exact number but is not one, such as `_01` or `_1e3`.
- **Stricter props.** `<Plural>` requires children, takes `n` as a `number` or a `bigint`, and no longer has a `locales` prop, so in Vue a `locales` attribute is a branch like any other. `<Select>` requires children unless its branches cover every value of `value`, as in `<Select value={isAdmin} true="Admin" false="Member" />`. `_locale` and `_enableI18n` are no longer in the prop types of `<Plural>` and `<Select>`. `gt-react` exports the `SelectProps` type beside `PluralProps`.
- **The translation picks the branch.** In a translated locale, the branch is chosen among the translation's branches, and the source branch of the same name fills in its variables and elements; when the source has no branch of that name, its children do. A source `_0` branch no longer renders untranslated in a locale whose translation has no `=0` branch. A translation with no branch for the value renders the source: that element in React and Vue, the whole `<T>` in Svelte.
- **Errors.** In React, an `n` that is not a number or a bigint, and a value with no branch and no children, throw in development. In production they log an error; a non-numeric `n` renders the children, and a missing branch renders nothing. Children that are empty, such as `{null}`, are a fallback that renders nothing. A `bigint` too large to have a plural category throws a `RangeError` unless an exact branch matches it, as in `plural()`. In Svelte, a branch passed as `undefined` counts as absent, as in React.
- **Synchronous `<Select>` in gt-next.** In a Server Component, gt-next's `<Select>` is now gt-react's component and no longer an async wrapper around it: choosing a branch never needed the request's locale.

A `<T>` with a `<Plural>` or a `<Select>` has new source content, so its hash changes and it is translated again: the children are stored as the `other` branch, and the elements and unnamed variables after them are numbered from the component, not from its children. `gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors all read the new props, so update them together with the runtime packages.

The `static-jsx` lint rule's fix writes `{x && "Active"}` as `<Select value={!!x} true="Active">{null}</Select>`, since a `false` value needs a fallback, and a `null` alternative of a ternary the same way. A string that JSX text would not read back as written, such as `"&amp;"` or `"a < b"`, is written in braces.

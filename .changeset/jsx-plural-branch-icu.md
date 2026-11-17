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

**Breaking:** `<Plural>` and `<Branch>` now choose a branch the way `plural()` and `select()` do, in React, Vue and Svelte.

- **ICU plural selection.** `<Plural>` picks an exact branch first, then the locale's plural category for `n`, then `other`. `zero`, `one` and `two` are plural categories, no longer the numbers 0, 1 and 2: in English `zero` never matches, and in Japanese neither does `one`. For an exact number write `_0`, `_1` and so on, the JSX spelling of ICU's `=0`: `<Plural n={count} _0="No items" one="1 item" other="Many items" />`. Stored content and translations use the ICU key, `=0`.
- **No aliases.** The `singular`, `plural` and `dual` branches are removed: write `one`, `other` and `two`. `PluralType` from `generaltranslation` no longer includes them.
- **`other` is the fallback.** Neither component takes `children` any more: move the fallback content to the `other` prop (in Vue and Svelte, the `other` slot or snippet). `<Branch other="...">` used to match only the value `"other"`; it now also renders for any value with no branch of its own. `gt` and the compiler warn about a `<Plural>` or `<Branch>` that still has children, and about a `<Plural>` prop that looks like an exact number but is not one, such as `_01` or `_1e3`.
- **Stricter props.** `<Plural>` requires `other`, takes `n` as a `number` or a `bigint`, and no longer has a `locales` prop, so in Vue a `locales` attribute is a branch like any other. `<Branch>` requires `other` unless its branches cover every value of `branch`, as in `<Branch branch={isAdmin} true="Admin" false="Member" />`. `_locale` and `_enableI18n` are no longer in the prop types of `<Plural>` and `<Branch>`. `gt-react` exports the `BranchProps` type beside `PluralProps`.
- **The translation picks the branch.** In a translated locale, the branch is chosen among the translation's branches, and the source branch of the same name fills in its variables and elements; when the source has no branch of that name, its `other` does. A source `_0` branch no longer renders untranslated in a locale whose translation has no `=0` branch. A translation with no branch for the value renders the source: that element in React and Vue, the whole `<T>` in Svelte.
- **Errors.** In React, an `n` that is not a number or a bigint, and a value with no branch and no `other`, throw in development. In production they log an error; a non-numeric `n` renders `other`, and a missing branch renders nothing. A `bigint` too large to have a plural category throws a `RangeError` unless an exact branch matches it, as in `plural()`. In Svelte, a branch passed as `undefined` counts as absent, as in React.

A `<T>` whose `<Plural>` or `<Branch>` used `children`, an alias or an exact-number branch has new source content, so its hash changes and it is translated again. `gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors all read the new props, so update them together with the runtime packages.

The `static-jsx` lint rule's fix writes the last alternative of a ternary as `other`: `{cond ? "yes" : "no"}` becomes `<Branch branch={cond} true="yes" other="no" />`, and `{x && "Active"}` becomes `<Branch branch={!!x} true="Active" other={null} />`. A string with an HTML entity is written in braces, so `"&amp;"` stays that text.

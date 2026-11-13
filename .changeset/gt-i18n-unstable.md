---
"gt-i18n": minor
"@generaltranslation/format": minor
"generaltranslation": minor
"@generaltranslation/react-core": patch
"gt-react-native": patch
"gt-svelte": patch
---

Add experimental `gt-i18n/unstable` and `gt-i18n/unstable/internal` entries. Their API may change in any minor release and is not covered by semver. `t` is a tagged template (`` t`Hello, ${{ name }}!` `` or `` t({ context })`Save` ``) that builds a message tree from the template, hashes it with `hashSource`, and formats loaded tree translations without the ICU string parser. Helpers `plural`, `selectordinal`, `select`, `number`, `date`, `part`, `derive`, and `n` are exported from `gt-i18n/unstable`; framework packages use `createGT` and `getGT` from `gt-i18n/unstable/internal`. Missing tree translations render the source message and, in dev hot reload, are sent for runtime translation like string and JSX messages. Template text is always literal, including ICU syntax such as `#`. A bare value (`` t`Hi ${name}` ``) is an anonymous variable and `${{ name }}` a named one; either renders like a template literal (`true` as `'true'`, `12n` as `'12'`, `null` and `undefined` as nothing), and a `Date` is a type error that points to `date()`; helpers take either form, as in `plural({ count }, ...)` or `plural(count, ...)`. Plural and select branches are strings, or `part` templates when they hold placeholders, and a plain template literal with values in a branch is a type error; `n` is the count of the nearest plural (`` part`${n} items` ``). `derive()` inlines static text chosen in code; its argument must be typed as a string literal or a union of them, so the CLI can read every variant from the type.

`Content` from `@generaltranslation/format/types` and `generaltranslation/types` replaces the `Translation` type, which `gt-i18n/types` no longer exports. Loaded catalogs, translation loaders, and the translations passed to React Core providers, gt-react-native's `LocaleTranslations`, and gt-svelte's `loadTranslations()` and `<GTProvider>` can hold message trees alongside string and JSX entries. Translation lookups and runtime translation take message trees with `$format: 'MESSAGE_TREE'`, like any other format.

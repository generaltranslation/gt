---
'@generaltranslation/compiler': minor
---

Add the experimental `experimentalPrecomputeJsx` option (or the `GT_PRECOMPUTE_JSX` environment variable). In a production build, each `<T>` imported from `gt-react` whose children are static becomes a precomputed component: the build tags the children, writes their source content as data and passes the values of a render as slots, so rendering looks the translation up by its hash without walking, tagging or hashing the children. Hashes and translation files are unchanged, and embedded translations (`files.gt.inlineTranslations`) still win over loaded ones. A `<T>` the build cannot analyze stays as it is: spread or locale props, `<Derive>`, `<RelativeTime>`, a `<T>` inside another `<T>`, a `locales` prop on a variable or branch component, or expressions whose order of evaluation would change. With `_tagIds`, and outside production builds, every `<T>` stays a component.

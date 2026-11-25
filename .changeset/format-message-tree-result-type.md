---
'@generaltranslation/icu': minor
'@generaltranslation/format': major
'generaltranslation': major
---

`GTIntl.formatMessageTree()` types its result by its values, as `formatMessageTree` in `@generaltranslation/icu` does: a `string` from plain values, and `FormattedMessage<R>` from rich values or tag formatters. It returned `unknown` for both. `formatMessageTree()` in `generaltranslation/internal` does the same. `@generaltranslation/icu` exports the `OnePartValues` type that these signatures use.

**Breaking:** the values are checked against one rich type `R`, where any value was accepted. Tag formatters that return different types no longer compile until `R` is written, as with `formatMessageTree` in `@generaltranslation/icu`:

```diff
- intl.formatMessageTree(tree, { values: { image: () => ({ src }), link: () => ({ href }) }, formats })
+ intl.formatMessageTree<Image | Link>(tree, { values: { image: () => ({ src }), link: () => ({ href }) }, formats })
```

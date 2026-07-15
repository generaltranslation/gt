---
'@generaltranslation/react-core': patch
---

Deprecate the `$`-prefixed sugar props on the `<T>` component (`$context`, `$id`, `$maxChars`, `$requiresReview`) in favor of the unprefixed forms (`context`, `id`, `maxChars`, `requiresReview`). Both forms keep working; support for the `$`-prefixed forms will be removed in the next major version. String-function options (`t()`, `gt()`, `msg()`) are unaffected.

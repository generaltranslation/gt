---
'gt': minor
---

The CLI skips two more tagged-template mistakes with a warning, instead of extracting them. A `plural` or `selectordinal` branch that is not a plural category (`zero`, `one`, `two`, `few`, `many`, `other`) or an exact `=N` key, like the misspelled `onee`, was extracted and rendered the `other` branch. A `select` without `other` whose value TypeScript types as a finite union of string literals, with no branch for some of them, was extracted with an empty `other` and rendered no text for those values. A `select` over a value that is not such a union, as in a JavaScript file or over `string`, is extracted as before.

`gt validate` now exits with code 1 and no longer prints "Success!" when it skips a tagged-template message: it lists the skipped messages as errors, and `getValidateJson()` reports them with `level: 'error'`. `gt translate`, `gt stage` and `gt generate` still warn and continue.

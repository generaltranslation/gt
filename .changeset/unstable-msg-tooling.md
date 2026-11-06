---
'gt': minor
'@generaltranslation/compiler': minor
---

The CLI extracts deferred `msg` messages imported from an `/unstable` entry as message trees. `` msg`...` `` and `` msg({ context, maxChars, requiresReview })`...` `` are extracted like `t`, including aliases, configured tags, and `derive()` variants. `msg('Save')`, or a template literal without values, uploads the literal text as the tree `['Save']`; any other `msg()` argument is skipped with a warning. Calls to the `m` function from `useMessages()` / `getMessages()` are not extracted. The compiler injects `$_hash` into static `` msg`...` `` templates, as it does for `t`.

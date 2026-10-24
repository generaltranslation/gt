---
'@generaltranslation/compiler': major
---

Remove the remaining backward compatibility:

- The `legacyGtReactImportSource` option and `files.gt.parsingFlags.legacyGtReactImportSource` are removed; injected imports always come from `gt-react` (or `autoJsxImportSource`).
- `gt-react/client` and `gt-react/browser` are no longer recognized as GT import sources; import from `gt-react`.
- `<T>` hashing no longer reads `$context`, `$id`, `$maxChars`, `$requiresReview`, or `$_hash`; use the unprefixed props.

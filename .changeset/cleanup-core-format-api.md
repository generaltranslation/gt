---
'generaltranslation': patch
'@generaltranslation/api': patch
---

- `generaltranslation` no longer exports the `JsonPrimitive` type; use `string | number | boolean | null`.
- `@generaltranslation/api`: `ApiClientConfig.timeoutMs` takes only a number; `timeoutMs: false` is removed. To let a custom `fetch` own timeouts, pass a `timeoutMs` longer than its own; any larger value works, `Infinity` included.
- `@generaltranslation/api` no longer exports the `PresignedFileUpload` type; use `Parameters<typeof putFileUpload>[0]`.

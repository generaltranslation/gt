---
'generaltranslation': minor
'@generaltranslation/api': minor
'gt': patch
'gt-sanity': patch
---

Consolidate base64, file-content, locale-mapping, and job-polling seams in `generaltranslation/internal`, remove the generated API package's workspace dependency surface, and reuse the core helpers in the CLI and Sanity integration. `encodeBase64`, `decodeBase64`, `encodeFileContent`, and `decodeFileContent` remain exported from `@generaltranslation/api` as deprecated shims; import the `generaltranslation/internal` equivalents instead.

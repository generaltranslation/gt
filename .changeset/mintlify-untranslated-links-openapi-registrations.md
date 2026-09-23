---
'gt': patch
---

Fix Mintlify postprocessing that broke default-locale content:

- Add `experimentalLocalizeStaticUrls: { skipUntranslatedPages: true }` to keep links to pages without a translation on the default locale instead of prefixing a locale that has no page. `true` keeps the existing behavior.
- Stop rewriting docs.json OpenAPI registrations outside `navigation.languages` to a target locale when only one locale was downloaded, which removed the default-locale API reference.

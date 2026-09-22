---
'gt': patch
---

Fix Mintlify postprocessing that broke default-locale content:

- Keep links to pages outside translation scope on the default locale instead of prefixing a locale that has no page.
- Stop rewriting docs.json OpenAPI registrations outside `navigation.languages` to a target locale when only one locale was downloaded, which removed the default-locale API reference.

---
'generaltranslation': major
---

`GTRuntime` and project-scoped `GeneralTranslation` instances no longer expose the credentials they were created with:

- `runtime.apiKey` and `runtime.userTokenProvider` are removed. Keep the value you pass to the constructor: `const runtime = new GTRuntime({ apiKey, projectId }); runtime.apiKey` → `apiKey`.

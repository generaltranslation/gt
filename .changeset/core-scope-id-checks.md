---
'generaltranslation': patch
---

`GeneralTranslation`, `GTRuntime`, `project(id)` and `org(id)` no longer check that an ID is a string, which the types already require. An empty or blank ID still throws the same error; a non-string ID from untyped code now throws a `TypeError`.

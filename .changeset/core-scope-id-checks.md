---
'generaltranslation': patch
---

`GeneralTranslation`, `GTRuntime`, `project(id)` and `org(id)` no longer check that an ID is a string, which the types already require. An empty or blank ID still throws the same error. Other values from untyped code are no longer rejected with it: a number or `null` throws a `TypeError` instead.

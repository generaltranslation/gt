---
'@generaltranslation/react-core-linter': minor
---

Add the `unstable-static-branch` rule, enabled in the recommended config. It reports a `plural`, `selectordinal`, or `select` branch from an `/unstable` entry that is not static text or `part`...``: a plain template literal with values renders them as text, so the message never matches a translation, and a branch read from a variable cannot be extracted. Its fix wraps the template in `part` and adds the import.

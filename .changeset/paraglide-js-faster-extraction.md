---
'@generaltranslation/paraglide-js': patch
---

Make `paraglide-context` and `collectContext()` faster on large projects: each file is parsed and analyzed in less time, and a barrel of many `export *` no longer makes a run quadratic. The metadata files are unchanged.

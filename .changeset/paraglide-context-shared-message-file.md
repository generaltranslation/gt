---
'@generaltranslation/paraglide-js': patch
---

When two inlang projects use the same base-locale message file, its metadata file now gets the source code of both projects' usages. Each project wrote the file with only its own usages, so the last write dropped the other's.

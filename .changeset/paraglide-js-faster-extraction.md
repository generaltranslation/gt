---
'@generaltranslation/paraglide-js': patch
---

Make `paraglide-context` and `collectContext()` faster on large projects: each file is parsed and analyzed in less time, a barrel of many `export *` no longer makes a run quadratic, an outdir with one file per message is read at once, and Vue, Svelte and Astro components cost less. The metadata files are unchanged. Files are also read a bounded number at a time: on Node 24 and older, a project with more files than the process may open lost usages without a warning.

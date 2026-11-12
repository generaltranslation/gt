---
'@generaltranslation/paraglide-js': patch
---

Make `paraglide-context` and `collectContext()` about twice as fast and lighter on memory, so that large projects finish. A barrel of many `export *` no longer makes a run quadratic, an outdir with one file per message is read at once, and Vue, Svelte and Astro components cost less. The metadata files are unchanged. Source files are now read at most 64 at a time. Before, on Node 24 and older, a project with more files than the process's open-file limit could leave usages out of the metadata files without a warning.

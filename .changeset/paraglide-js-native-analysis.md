---
'@generaltranslation/paraglide-js': patch
---

Rewrite the usage analysis of `paraglide-context` and `collectContext()` in Rust, as a Node addon that reads, parses and analyzes a project on every core. A project of 10,000 source files is analyzed in under a second instead of about four, and one of 100,000 files in about six seconds within 5 GB of memory. The metadata files are unchanged. When several files pass different messages to the same parameter, their usages are now reported in the same order on every run. A language that claims scripts with `detect` can name the texts its files contain in `mayContain`, so that other scripts are not read in JavaScript.

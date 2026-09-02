---
'gt': minor
'generaltranslation': patch
'@generaltranslation/api': patch
---

Add Android `strings.xml` support to the CLI. Configure an `androidStrings` entry under `files` in `gt.config.json` to upload Android string resources and download the translated per-locale files.

Translations are written to the resource directory the platform expects, so `fr-CA` becomes `values-fr-rCA` and `zh-Hans` becomes `values-b+zh+Hans`. Android reads the locale out of the directory name and fails the build on one it cannot parse.

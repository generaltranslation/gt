---
'@generaltranslation/api': patch
'generaltranslation': patch
'gt': patch
---

Rename the `.strings` and `.stringsdict` file formats. The API format names become `DOT_STRINGS` and `DOT_STRINGSDICT`, and the `gt.config.json` keys under `files` become `dotStrings` and `dotStringsdict`.

**This is a breaking configuration change.** A `gt.config.json` that still uses `files.strings` or `files.stringsdict` will silently stop matching those files, because the old keys are no longer recognised file types. Rename them to `files.dotStrings` and `files.dotStringsdict`. The file extensions on disk are unchanged, and translated output is still written as `.strings` and `.stringsdict`.

The old names identified a vendor rather than a file. Apple ships four string formats — `.strings`, `.stringsdict`, `.xcstrings` and `.plist` — so `APPLE_STRINGS` never said which one it meant. The new names identify the extension itself, the way developers say it out loud.

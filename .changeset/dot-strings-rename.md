---
'gt': minor
'generaltranslation': patch
---

Rename the `.strings` and `.stringsdict` file formats from `APPLE_STRINGS` and `APPLE_STRINGSDICT` to `DOT_STRINGS` and `DOT_STRINGSDICT`. The old names identified a vendor rather than a file, and Apple ships four string formats — `.strings`, `.stringsdict`, `.xcstrings` and `.plist` — so `APPLE_STRINGS` never said which one it meant. The new names identify the extension itself, the way developers say it out loud.

The `strings` and `stringsdict` keys under `files` in `gt.config.json` are unchanged, so no configuration needs editing. The format names travel on the wire, so this release requires an API that accepts the new names.

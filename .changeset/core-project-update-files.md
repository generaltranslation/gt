---
'generaltranslation': minor
---

`project.updateFiles(files)` updates source files, or their translations when a file names a locale, such as a version's `metadata.previewUrl`. It replaces the 2.x adapter's `updateFiles` (#2653), in batches of 100 that each write all or nothing. Each branch, file, version, and locale may appear once in the list; a repeated target throws before any request is sent.

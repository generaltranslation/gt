---
'gt': minor
'generaltranslation': patch
'@generaltranslation/api': patch
---

Add Apple `.strings` support to the CLI. Configure a `strings` entry under `files` in `gt.config.json` to upload `.strings` sources and download the translated per-locale files. `.strings` files written as UTF-16 by older versions of Xcode upload correctly: their bytes are sent unmodified so the API can read the byte order mark.

Fix `save-local` for formats whose content travels base64. It compared the local file against the still-encoded server copy, so a Lottie translation reported an edit on every run. Unchanged files are now recognised, and an edited file whose bytes are not valid UTF-8 is reported by name rather than submitted as unreadable text.

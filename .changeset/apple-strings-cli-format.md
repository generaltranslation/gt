---
'gt': minor
'generaltranslation': patch
'@generaltranslation/api': patch
---

Add Apple `.strings` support to the CLI. Configure a `strings` entry under `files` in `gt.config.json` to upload `.strings` sources and download the translated per-locale files. `.strings` files written as UTF-16 by older versions of Xcode upload correctly: their bytes are sent unmodified so the API can read the byte order mark.

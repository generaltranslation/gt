---
'generaltranslation': patch
'gt': patch
---

Fix UTF-16 `.stringsdict` files being corrupted before upload.

Older Xcode wrote `.stringsdict` as UTF-16, and legacy repositories still contain them. Such a file is valid — `plutil` accepts it and it renders correctly on device — but the CLI read every `.stringsdict` as UTF-8 text, which replaced those bytes with U+FFFD before the file ever left the machine. The API could not repair what it never received.

`DOT_STRINGSDICT` now joins `LOTTIE` and `DOT_STRINGS` in `BINARY_FILE_FORMATS`, so its bytes travel base64-encoded end to end and the API picks a decoder from the byte order mark.

UTF-8 `.stringsdict` files, with or without a byte order mark, upload the same bytes as before. Their version id changes once, because it is now hashed from the base64 payload rather than the decoded text, so each file re-translates a single time.

---
'generaltranslation': patch
'gt': patch
---

Fix UTF-16 `.strings` and `.stringsdict` files being corrupted or rejected on upload.

Older Xcode wrote both formats as UTF-16, and legacy repositories still contain them. The CLI read every file as UTF-8 text, so a UTF-16 `.stringsdict` reached the API as mojibake and its XML parser rejected it outright — the file could not be uploaded at all. A UTF-16 `.strings` file did upload, but came back as byte-order-mark-less UTF-8, so every one of them showed as rewritten in `git diff`.

Encoding is now handled entirely by the CLI, which is the only part of the pipeline that touches the filesystem, and within the CLI by a single module at the disk boundary. Reads decode by byte order mark, so the API only ever receives UTF-8 text. Writes re-encode to the source file's own encoding, which the CLI already knows because it just read that file, so a UTF-16 repository stays UTF-16 and a UTF-8 one gains no byte order mark. This also fixes re-downloading a UTF-16 `.stringsdict` source, which previously produced a file `plutil` rejected with `Unexpected character ã at line 1`.

If the source file has been moved or deleted since it was uploaded, the translation already on disk is used as the record of the encoding instead, so those files keep their encoding rather than being rewritten as UTF-8.

The content hash recorded for a downloaded translation is now taken from its decoded text as well, so a file stored in UTF-16 stops reading as edited on every run because its hash had been computed from bytes read as UTF-8.

A file with no byte order mark is treated as UTF-8 even when its bytes are plainly UTF-16, matching Foundation: `plutil` rejects those files too, so guessing would translate content the platform itself cannot read.

`DOT_STRINGS` leaves `BINARY_FILE_FORMATS`, which now contains only `LOTTIE`. Every `.strings` file's version id changes once, because it is now hashed from the decoded text rather than the base64 payload, so each one re-translates a single time.

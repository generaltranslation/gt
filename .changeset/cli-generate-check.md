---
'gt': minor
---

`gt generate --check` writes nothing and exits with code 1 when the source translation file or a locale's translation file is out of date with the source code, listing the files, so CI can catch a forgotten `gt generate`. `gt generate --dry-run` now writes nothing and lists the files it would write; it used to write them.

`gt generate` itself now writes only the files whose content would change, so a file that is current keeps its formatting, and `--dry-run` lists exactly the files a run would write. It also stops with an error when a locale's translation file is not valid JSON; it used to replace that file's translations with source text. And it keeps the translation of a message whose source text is empty; it used to remove it.

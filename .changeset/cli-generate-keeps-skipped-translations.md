---
'gt': patch
---

`gt generate` no longer removes translations when it could not parse a source file. A file with a syntax error, or with syntax the scanner does not read, is skipped, and the messages in it used to be removed from the source file and from every locale's file, hand-written translations included. Now, when a file was skipped, every message and translation already saved is kept, and a warning names the files. Pass `--ignore-errors` to remove what was not found anyway.

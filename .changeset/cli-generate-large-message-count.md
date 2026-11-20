---
'gt': patch
---

`gt generate`, `gt validate` and `gt translate` no longer fail with `RangeError: Maximum call stack size exceeded` on a project with more than about 125,000 messages. The step that merges duplicate messages passed every message to one call as a separate argument, which is more than the JavaScript engine accepts; it now adds them one at a time. The steps that collect a project's files and downloads do the same, so they do not fail at that number of files.

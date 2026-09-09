---
"gt": patch
---

Record download bookkeeping per locale for translation files that hold every locale, so every locale keeps its post-process hash and unchanged in-place files are no longer resubmitted as user edits by save-local. A standalone `gt download` now records the hash of each file it writes, so later save-local and upload runs skip files that were not edited.

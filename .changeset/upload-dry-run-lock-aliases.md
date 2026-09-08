---
'gt': patch
---

fix(cli): make `gt upload --dry-run` a true no-op and stop re-uploading unchanged translations for `customMapping` locales. The upload command accepted `--dry-run` but ignored it; it now lists what would be sent (honoring the `gt-lock.json` skip check), requires no credentials, and never calls the API or publishes. Separately, the server confirms translation uploads under GT's canonical locale code while local files carry the configured alias (for example `he-IL` -> `he`), so aliased locales never got a `gt-lock.json` hash and re-uploaded on every run. Confirmations are now matched in canonical locale space and the API wrapper maps confirmed locales back to their configured alias, consistent with download.

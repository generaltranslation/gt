---
'gt': patch
---

`gt download` now waits for translations that are still processing, up to `--timeout` (900 seconds by default), as its docs describe. It used to check once and report each file that was still processing as a failed download. Files that are not ready when the timeout passes are listed as still processing, and `--timeout 0` checks once. `gt translate` with `stageTranslations` enabled downloads the same way. With `--experimental-clear-locale-dirs`, a download that times out no longer clears a locale directory that still has files processing.

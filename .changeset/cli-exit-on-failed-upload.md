---
'gt': minor
---

`gt upload`, `gt stage`, `gt translate` and `gt setup` now exit with code 1 when any file fails to upload, so CI notices. The run still finishes and prints the warnings summary first. Fonts that don't sync are reported as "Fonts not synced" and don't affect the exit code, since translation continues without them.

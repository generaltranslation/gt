---
'@generaltranslation/format': minor
'generaltranslation': minor
---

`GTIntl.formatIcu()` takes a `timeZone` for one call, as `formatDateTime()`, `formatMessageTree()` and the standalone `formatIcu()` do: `intl.formatIcu('{at, time, short}', { values: { at }, timeZone: 'UTC' })`. Without one it uses the instance's time zone, as before.

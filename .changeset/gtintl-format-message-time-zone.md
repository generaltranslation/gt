---
'@generaltranslation/format': minor
'generaltranslation': minor
---

`GTIntl.formatMessage()` takes a `timeZone` for one call, as `formatDateTime()`, `formatMessageTree()` and the standalone `formatMessage()` do: `intl.formatMessage('{at, time, short}', { variables: { at }, timeZone: 'UTC' })`. Without one it uses the instance's time zone, as before.

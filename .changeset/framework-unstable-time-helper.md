---
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-react-native': minor
'gt-next': minor
'gt-tanstack-start': minor
'gt-node': minor
---

The `/unstable` entries export `time()`, which formats a time with `timeStyle` or time fields, next to `date()`. A `timeZone` in `gt.config.json` or the `initializeGT()` config sets the default time zone of dates and times in these messages; in gt-next, `withGTConfig()` forwards a `timeZone` from its props or `gt.config.json`.

---
'@generaltranslation/icu': patch
---

`formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Rendering messages that format a number, date or plural is about 20 times faster.

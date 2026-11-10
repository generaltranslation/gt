---
'@generaltranslation/icu': patch
---

`formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Messages that format a number or plural render about 20 times faster, and so do dates with a `timeZone`; a date without one takes the host's time zone, so its formatter is still built on each call.

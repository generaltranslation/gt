---
'@generaltranslation/compiler': patch
'gt': patch
'generaltranslation': patch
---

`files.gt.inlineTranslations` now also embeds tagged-template messages that use helpers, for `t` from `gt-react/unstable` and the `gt` of `useGT()` or `getGT()` from `gt-react/unstable` or `gt-tanstack-start/unstable`: `plural`, `select`, `selectordinal`, `number`, `date`, `time`, `part` and `n`, where each value is named, as in `plural({ count }, ...)`. Until now only templates whose holes were all `${{ name }}` were embedded, so an app with plural or select messages still had to load them. `gt translate` and `gt generate` leave the same messages out of `inlineTranslations.msgOutput` files. Messages with a value that has no name, such as `plural(count, ...)`, with `derive`, or from `msg`, and every message of the gt-next entry points, are embedded and loaded as before.

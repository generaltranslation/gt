---
'@generaltranslation/compiler': minor
'gt': minor
'generaltranslation': minor
---

Add `files.gt.inlineTranslations.helpers` to gt.config.json. When it is `true`, `files.gt.inlineTranslations` also embeds tagged-template messages that use helpers, for `t` from `gt-react/unstable` and the `gt` of `useGT()` or `getGT()` from `gt-react/unstable` or `gt-tanstack-start/unstable`: `plural`, `select`, `selectordinal`, `number`, `date`, `time`, `part` and `n`, where each value is named, as in `plural({ count }, ...)`. `gt translate` and `gt generate` then leave the same messages out of `inlineTranslations.msgOutput` files, so a build of one locale has nothing left to load for them.

It is off by default: only templates whose holes are all `${{ name }}` are embedded, as before, and messages that use helpers stay in the `msgOutput` files. An embedded helper message ships its branches for every embedded locale, so turn it on for builds of one locale each (`experimentalStaticLocale`), not for one build that embeds several locales. Messages with a value that has no name, such as `plural(count, ...)`, with `derive`, or from `msg`, and every message of the gt-next entry points, are embedded and loaded as before whatever the setting.

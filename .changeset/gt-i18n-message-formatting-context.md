---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-react-native': minor
'gt-next': minor
'gt-tanstack-start': minor
'gt-node': minor
'generaltranslation': patch
---

In the `/unstable` entries, `number()`, `date()` and the new `time()` split their options. Message options (`style`, `unit`, date and time fields) are part of the message and must be one literal. `date()` and `time()` name their style `style`, as `number()` does: `date({ due }, { style: 'medium' })` and `time({ start }, { style: 'short' })`, not Intl's `dateStyle` and `timeStyle`. Formatting context, such as `currency` or `timeZone`, may be any value and never changes the message's hash, so `currency: order.currency` is translated once; a `Msg` carries it in `formats`, which is `{}` when there is none. A `timeZone` in `gt.config.json`, `initializeGT()` or `withGTConfig()` sets the default time zone.

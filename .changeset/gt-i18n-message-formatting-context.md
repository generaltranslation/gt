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

In the `/unstable` entries, `number()`, `date()` and the new `time()` split their options. Message options (`style`, `unit`, `dateStyle`, `timeStyle`, date and time fields) are part of the message and must be one literal. Formatting context, such as `currency` or `timeZone`, may be any value and never changes the message's hash, so `currency: order.currency` is translated once; a `Msg` carries it in `formats`. A `timeZone` in `gt.config.json`, `initializeGT()` or `withGTConfig()` sets the default time zone. A message without placeholders is one string tree, so its hash changes once.

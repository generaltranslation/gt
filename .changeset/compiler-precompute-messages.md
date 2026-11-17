---
'@generaltranslation/compiler': minor
---

Build the message of each static `t` template from an `/unstable` entry at compile time. The template becomes a call that reads its message, declared once at module scope with its hash, message tree and literal options, so the call site builds no tree and allocates no options when it renders: `` t`Hello, ${{ name }}!` `` compiles to `t(_gt, { name })`. This covers `t`, `useGT()` and `getGT()` templates with named or plain values and static `plural`, `selectordinal`, `select`, `part`, `n`, `number`, `date` and `time` helpers. `msg` templates, `derive()` and other non-static templates keep the tagged template, as before. Hashes do not change.

With `experimentalReplaceSource`, a replaced template's message holds the translation's tree and its locale, so it embeds no `inline` callback and imports no message module.

These calls need runtime packages (`gt-react`, `gt-next`, `gt-i18n` and the others with an `/unstable` entry) from the same release. Set the new `precomputeMessages: false` plugin option to keep the tagged templates.

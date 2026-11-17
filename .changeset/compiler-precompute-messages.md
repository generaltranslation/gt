---
'@generaltranslation/compiler': minor
---

Build the message of each static `t` template from an `/unstable` entry at compile time. The template becomes a call that passes its message, with its hash, message tree and literal options, so the call site builds no tree when it renders. A message with values is declared once at module scope: `` t`Hello, ${{ name }}!` `` compiles to `t(_gt, { name })`. A message that is text is written at its call: `` t`Save` `` compiles to `t({ $_hash, $_tree: 'Save' })`. This covers `t`, `useGT()` and `getGT()` templates with named or plain values and static `plural`, `selectordinal`, `select`, `part`, `n`, `number`, `date` and `time` helpers. `msg` templates, `derive()` and other non-static templates keep the tagged template, as before. Hashes do not change.

With `experimentalReplaceSource`, a replaced template's message holds the translation's tree and its locale, so it embeds no `inline` callback and imports no message module. The runtime renders that tree in the build's locale without reading the current locale or looking anything up, like a replaced `<T>`: a per-locale build shows its own language whatever locale the browser asks for.

These calls need runtime packages (`gt-react`, `gt-next`, `gt-i18n` and the others with an `/unstable` entry) from the same release. Set the new `precomputeMessages: false` plugin option to keep the tagged templates.

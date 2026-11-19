---
'@generaltranslation/compiler': minor
---

Build the message of each static `t` template at compile time. The template becomes a call that passes its message, with its hash, message tree and literal options, so the call site builds no tree when it renders. The message is written at the call and nothing is declared at module scope, so a call that runs before its module's body has run, as through an import cycle, works as the template did: `` t`Hello, ${{ name }}!` `` compiles to `t({ $_hash, $_tree: ['Hello, ', ['name'], '!'] }, { name })`, and `` t`Save` `` to `t({ $_hash, $_tree: 'Save' })`. This covers `t`, `useGT()` and `getGT()` templates with named or plain values and static `plural`, `selectordinal`, `select`, `part`, `n`, `number`, `date` and `time` helpers. `msg` templates, `derive()` and other non-static templates keep the tagged template, as before. Hashes do not change.

These calls need runtime packages (`gt-react`, `gt-next`, `gt-i18n` and the other GT runtime packages) that read them. A file's templates are precomputed when the compiler finds the GT runtime that file resolves and it reads these calls. Next to an older runtime, and where it finds no runtime, it keeps the tagged templates and says so once per build; the new `precomputeMessages` plugin option sets it either way. A build is precomputed when its chunks hold `$_tree:`.

A build with `experimentalSplitTranslations` splits the translations of these calls by chunk, or by module with `by: 'module'`, as it splits those of tagged templates.

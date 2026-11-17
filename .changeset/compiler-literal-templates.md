---
'@generaltranslation/compiler': patch
---

With `experimentalReplaceSource`, a `t` or `gt` template from `/unstable` that has no variables now compiles to the string it renders in the build's locale: `` t`Save` `` becomes `"Enregistrer"` in a `fr` build and `"Save"` in a build for the source locale, with no call, hash or embedded callback left. Templates with variables, and templates with `maxChars`, are compiled as before, since their output is formatted at runtime; `msg` templates are untouched.

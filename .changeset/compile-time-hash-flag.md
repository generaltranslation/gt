---
'@generaltranslation/compiler': patch
---

Honor the `compileTimeHash` option: setting it to `false` now actually disables hash injection (previously it was ignored and injection always ran). The default flips to `true`, matching the previously observed always-inject behavior, so default behavior is unchanged.

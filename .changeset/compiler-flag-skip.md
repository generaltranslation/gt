---
'@generaltranslation/compiler': patch
---

fix: `disableBuildChecks: true` with `compileTimeHash: false` no longer turns off the whole compiler. Macro expansion, automatic JSX injection and dev hot reload now run for that option pair, as they do for each option alone. Files with invalid usage are still left untransformed, and their errors are now logged.

---
'@generaltranslation/react-core': patch
---

Fix tagged template `t` translations for `derive()` content without the compiler. The interpolated message is now looked up and formatted as ICU, matching the hash the CLI registers.

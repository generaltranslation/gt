---
'@generaltranslation/paraglide-js': patch
---

`paraglide-context` no longer stops with "Maximum call stack size exceeded" on a variable that is assigned a spread of itself, like `msgs = { ...msgs }`. The right side now reads what the variable held before the assignment.

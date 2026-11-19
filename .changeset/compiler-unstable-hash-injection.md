---
'@generaltranslation/compiler': minor
'generaltranslation': patch
'gt': patch
---

Inject compile-time `$_hash` values into statically analyzable tagged templates (`t`, `useGT()`, `getGT()`), so the runtime skips hashing them. Templates using `derive()` or other non-static values are left for the runtime to hash. The list of entries that export the message helpers lives in `generaltranslation/internal`.

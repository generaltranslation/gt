---
'@generaltranslation/compiler': minor
'generaltranslation': patch
'gt': patch
---

Inject compile-time `$_hash` values into statically analyzable `/unstable` tagged templates (`t`, `useGT()`, `getGT()`), so the runtime skips hashing them. Templates using `derive()` or other non-static values are left for the runtime to hash. The list of unstable import sources now lives in `generaltranslation/internal`.

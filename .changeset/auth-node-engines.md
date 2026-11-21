---
'@generaltranslation/auth': patch
---

Declare the Node.js version the package needs: `engines.node` is `>=20.19.0`. Login combines abort signals with `AbortSignal.any`, which Node.js added in 20.3.0, and the `@noble/hashes` dependency of `generaltranslation` requires Node.js 20.19.0. On an older Node.js, login failed at runtime with `AbortSignal.any is not a function` instead of warning at install time.

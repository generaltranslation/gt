---
'@generaltranslation/auth': patch
---

Declare the Node.js version the package needs: `engines.node` is `>=20.3.0`. Login combines abort signals with `AbortSignal.any`, which Node.js added in 20.3.0; on an older Node.js it failed at runtime with `AbortSignal.any is not a function` instead of warning at install time.

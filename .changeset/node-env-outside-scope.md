---
'gt-node': patch
---

Outside a `withGT()` scope, translation and locale functions throw only when `NODE_ENV` is `development`. Any other value, including an unset `NODE_ENV`, warns and falls back to the default locale, the same rule the translation cache and development hot reload use.

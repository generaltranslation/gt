---
'generaltranslation': major
'gt-next': major
'gt': major
---

**Breaking:** message hashes are now 11 base64url characters instead of 16 hex characters. `hashString` and `hashSource` in `generaltranslation/id`, and the gt-next SWC plugin, encode the same first 64 bits of the SHA-256 digest more densely, so every translation file and compiled call site is 5 bytes smaller per message, and the risk of a collision is unchanged.

Translations keyed by the old hashes are no longer found. Since a new hash holds the same bits, an old hash converts to its new one without the source, for example `Buffer.from(oldHash, 'hex').toString('base64url')`. To re-key a local translation file, convert each key. Otherwise, run `gt translate` again.

The `gt` CLI writes the new hashes for JavaScript projects. For Python projects it keeps writing the 16 hex characters that the gt-python runtime still looks up.

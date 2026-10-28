---
'gt-react': patch
---

The development localStorage translation cache now ignores stored data that is not a JSON object and purges entries whose expiry is missing or does not compare as a number, so edited or corrupted storage no longer blocks new writes.

---
'gt-i18n': patch
---

Concurrent misses for one message notify the translations cache miss listener once, as they already make one request, instead of once per caller.

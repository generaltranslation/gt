---
'gt-next': patch
---

Use a full browser reload instead of refreshing only server components so the client reinitializes with the server-selected locale, including when a requested locale falls back to the current page.

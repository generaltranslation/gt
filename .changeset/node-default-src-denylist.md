---
'gt': patch
---

The default gt-node scan also skips `dist`, `build`, `coverage`, `public`, `test`, `tests` and `__tests__` folders at any depth, `*.test.*` and `*.spec.*` files, and `.d.ts` declaration files, which cannot hold translation calls.

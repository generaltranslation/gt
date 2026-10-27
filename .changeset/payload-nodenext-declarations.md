---
'gt-payload': patch
---

Fix the published type declarations for consumers using TypeScript `moduleResolution` `node16` or `nodenext`. Relative imports in the declarations now include their `.js` extensions, so they resolve instead of failing.

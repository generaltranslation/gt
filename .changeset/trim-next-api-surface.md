---
"gt-next": patch
"gt": patch
---

Clean up the `gt-next` API surface for the next major prerelease.

Removes the deprecated `initGT` config alias and the redundant `gt-next/types` subpath. Moves the hidden dictionary and loader subpaths under `gt-next/internal/*`, updates the Next config alias plumbing to match, and adjusts CLI setup detection so it no longer treats `initGT` as a valid existing config wrapper.

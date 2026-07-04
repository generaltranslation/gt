---
"gt-i18n": patch
"gt-react": patch
---

Slim the i18n cache event surface by replacing the generic EventEmitter base class with a single cache-miss listener and removing unused cache helper methods.

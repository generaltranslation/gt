---
"gt-i18n": patch
"gt-react": patch
---

Slim the i18n cache for production bundles: replace the generic EventEmitter with a single dev cache-miss listener, remove dead I18nCache methods, statically gate dev hot-reload prefetch and localStorage machinery so bundlers can drop them, and ship an unbundled tree-shakeable ESM build of gt-i18n.

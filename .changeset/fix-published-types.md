---
'gt': patch
'gtx-cli': patch
'gt-next': patch
'gt-payload': patch
'@generaltranslation/react-core': patch
'@generaltranslation/python-extractor': patch
'@generaltranslation/vue-extractor': patch
---

Fix published type declarations that failed to resolve, or resolved to CommonJS types, under `moduleResolution` `node16` or `nodenext`.

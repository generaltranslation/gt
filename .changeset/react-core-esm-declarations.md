---
'@generaltranslation/react-core': patch
---

Add ESM declaration entry points (`.d.mts`) for the `import` condition of each entry point. They re-export the CommonJS declarations, so Node16/NodeNext ESM consumers get ESM types while sharing one set of declarations with packages such as gt-react-native that reach react-core through `require`.

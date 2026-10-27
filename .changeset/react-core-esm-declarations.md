---
'@generaltranslation/react-core': patch
---

Ship ESM declarations (`.d.mts`) for the `import` condition of each entry point, so Node16/NodeNext ESM consumers no longer get CommonJS types for the ESM build.

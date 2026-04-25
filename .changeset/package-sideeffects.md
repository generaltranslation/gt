---
'generaltranslation': patch
'gt-react': patch
'@generaltranslation/react-core': patch
'gt-i18n': patch
'gt-next': patch
'gt-react-native': patch
'gt-tanstack-start': patch
'gt-node': patch
---

Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

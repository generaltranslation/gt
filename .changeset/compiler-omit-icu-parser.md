---
'@generaltranslation/compiler': minor
'@generaltranslation/icu': minor
---

Add the experimental `experimentalOmitIcuParser` compiler option (or the `GT_OMIT_ICU_PARSER` environment variable), for apps whose messages are all `<T>` and tagged templates from an `/unstable` entry point. A production build then leaves the ICU message string parser out of the bundle, about 6.5 KB gzip: message trees and JSX are formatted without it. A module that imports something that works with ICU strings, such as `useGT()`, `msg()` or `t()` from a stable entry point, fails the build with the import's location. The compiler sets this up in Vite and esbuild builds, and through `resolveId` in the other bundlers it supports.

`@generaltranslation/icu/parser` has a `gt-omit-icu-parser` export condition that resolves it to a build without the parser, which is what the compiler option selects; `parse()`, `formatIcu()` and `printAST()` throw there.

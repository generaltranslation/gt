---
"@generaltranslation/compiler": patch
"gt-i18n": patch
"gt-next": patch
---

Support dev hot reload lookups for server `getGT` strings.

`getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

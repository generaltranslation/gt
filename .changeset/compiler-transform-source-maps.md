---
'@generaltranslation/compiler': patch
---

The compiler's transform returns a source map. It returned none, so the bundler kept the map of the code the compiler received: a stack trace or a debugger showed the right file and line with the wrong column, in every file the compiler changed. On webpack and Rspack the map is traced through the one the earlier loaders passed on, which needs `unplugin` 2.3.11 (the compiler now requires it), and without such a map nothing changes there. In an esbuild build it is traced through the map a file names in its `sourceMappingURL` comment. A Vite or esbuild build without source maps writes no map, so it takes no longer than before.

---
'@generaltranslation/compiler': patch
---

A build with the experimental `experimentalSplitTranslations` option keeps its source maps accurate. The build rewrites chunks after the bundler has rendered them (the call that starts the app, each dynamic import, and with `minifyHashes` every call site), and returned no source map for those rewrites: a position in such a chunk mapped to another line of its file, and Rolldown warned of a broken source map once per chunk. Each rewrite now carries its map, in builds with `sourcemap` set to `true`, `'hidden'` or `'inline'`. What the build emits is unchanged.

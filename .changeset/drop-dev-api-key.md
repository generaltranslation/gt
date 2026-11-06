---
'gt-i18n': major
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt-node': major
'gt-svelte': patch
---

Remove the `devApiKey` option. One `apiKey` now covers both uses: in development it enables hot reload translation, and in production it lets server code translate at runtime. Pass your key as `apiKey` wherever you passed `devApiKey`, for example `initializeGT({ apiKey })` in gt-node.

gt-react ignores an `apiKey` that reaches production browser code and logs a warning, because anyone can read a key from a browser bundle. Translate at runtime on your server instead.

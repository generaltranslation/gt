---
'@generaltranslation/compiler': patch
---

With `minifyHashes` in the experimental `experimentalSplitTranslations` option, a module is compiled with a placeholder at each call site the build splits, which becomes the id once the bundler has formed the chunks. That placeholder is now exactly as long as the hash it stands for, 16 characters, where it was 44. A bundler that limits the size of a chunk, as with a `maxSize` on a code-splitting group, measures modules before their chunks are rendered, so it measured the placeholders and split such a group into more chunks than a build without hash minification. It now measures a call site as it does with the option off, so turning hash minification on or off moves no chunk boundary. The files a build without a size limit writes are unchanged, byte for byte.

A placeholder is `~`, the hash in base64url, and `~` up to the length of the hash. The build keeps every placeholder it writes and minifies only those, so a string of the app that starts with `~` is never taken for one, and it still fails when a chunk reaches the output with one of its placeholders.

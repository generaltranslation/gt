---
'generaltranslation': major
'@generaltranslation/format': major
'gt-i18n': major
'gt-next': major
'gt-node': major
'gt-react': major
'@generaltranslation/react-core': major
'gt-react-native': major
'gt-rrweb': major
'gt-tanstack-start': major
---

Remove `typesVersions`. Subpath types such as `gt-next/server` now resolve only through `exports`, which needs `moduleResolution` `bundler` (TypeScript 5.0+) or `node16`/`nodenext` (TypeScript 4.7+). `moduleResolution` `node` (node10) is no longer supported, including its implicit use with `module: commonjs` in TypeScript 5.9 and earlier and in create-next-app projects from Next.js 13.4.10 and earlier.

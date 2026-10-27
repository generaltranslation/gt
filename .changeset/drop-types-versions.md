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

Remove `typesVersions` from `package.json`. Declarations now resolve only through `exports`. Using these packages from TypeScript requires `moduleResolution` set to `node16`, `nodenext` or `bundler`. `moduleResolution` `node` (node10) is deprecated in TypeScript 6 and removed in TypeScript 7, and it cannot resolve subpath imports such as `generaltranslation/types` or `gt-next/server`. Projects that already use `bundler`, `node16` or `nodenext`, including the default Next.js, Vite, Expo and TanStack Start setups, need no change.

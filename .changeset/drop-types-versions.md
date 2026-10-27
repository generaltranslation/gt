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

Remove `typesVersions`. Types now resolve only through `exports`, so TypeScript projects need `moduleResolution` `bundler`, `node16` or `nodenext` to import subpaths such as `gt-next/server`.

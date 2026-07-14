---
'gt-react': patch
'gt-next': patch
'gt-i18n': patch
'@generaltranslation/react-core': patch
---

Remove unused dependencies: `@generaltranslation/supported-locales` from gt-react, gt-next, gt-i18n, and @generaltranslation/react-core, and `@generaltranslation/format` from gt-react. Nothing in these packages imports them, so this only reduces install weight.

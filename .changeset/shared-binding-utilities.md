---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-vue': patch
---

Share framework-agnostic binding utilities through gt-i18n's internal entrypoint (plural branch selection, variable naming and formatting cores, format-locale resolution, the dev hot reload runtime translation queue, msg resolution, dictionary translation resolution, and browser cookie helpers). react-core, gt-react, and gt-vue now consume these shared implementations instead of duplicating them.

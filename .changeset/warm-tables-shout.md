---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-next': patch
'gt-node': patch
---

fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized

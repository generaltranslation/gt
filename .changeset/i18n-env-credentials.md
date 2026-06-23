---
'gt-i18n': patch
---

fix: read `GT_PROJECT_ID`, `GT_API_KEY`, and `GT_DEV_API_KEY` from the environment as a fallback in the I18nManager config, so server runtimes (e.g. `gt-node`'s `initializeGT()`) pick up credentials without passing them explicitly

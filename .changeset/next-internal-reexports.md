---
'gt-next': patch
---

Import symbols from the package that defines them: `gt-i18n` and `generaltranslation` functions, cookie names from `gt-i18n/internal/cookies`, and React plumbing (`createRenderPipeline`, `ReactI18nCache`, `getTranslationsSnapshot`) from `@generaltranslation/react-core`. Components and hooks still come from `gt-react`, whose export conditions pick the `react-server` or client build. Internal middleware pass-through modules are removed. No public API change.

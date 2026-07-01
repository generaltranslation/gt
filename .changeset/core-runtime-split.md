---
"generaltranslation": patch
"gt-i18n": patch
"gt-next": patch
"@generaltranslation/react-core": patch
---

Split the runtime surface of the GT class (locale management, formatting, runtime translation) into a GTRuntime base class exported from the new `generaltranslation/runtime` entry point. The SDK runtime (gt-i18n's I18nConfig, gt-next middleware) now constructs GTRuntime, so production browser bundles no longer ship the project/file management API client (enqueueFiles, uploads, downloads, etc.). The GT class extends GTRuntime and keeps its full API for the CLI and other tooling. Also import getLocaleProperties from @generaltranslation/format directly in react-core so client bundles don't reach the full core entry.

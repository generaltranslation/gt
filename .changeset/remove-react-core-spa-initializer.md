---
"@generaltranslation/react-core": patch
"gt-react": patch
---

Remove the deprecated `internalInitializeGTSPA` export from `@generaltranslation/react-core/pure` and the downstream `gt-react` server/types surfaces. Use `initializeGTSPA` from `gt-react` for browser SPA initialization.

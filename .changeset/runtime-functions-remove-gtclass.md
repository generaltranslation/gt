---
"generaltranslation": patch
"gt-i18n": patch
"@generaltranslation/react-core": patch
"gt-react": patch
"gt-react-native": patch
"gt-next": patch
---

Add a function-based `generaltranslation/runtime` entrypoint for runtime translation and move framework runtimes off the full `GT` class.

Remove the legacy `getGTClass` and `useGTClass` exports from the i18n, React, React Native, and Next runtime surfaces.

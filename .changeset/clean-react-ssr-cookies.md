---
'@generaltranslation/react-core': patch
'gt-next': patch
'gt-react': patch
'gt-react-native': patch
'gt-tanstack-start': patch
---

Use server-provided locale and condition props as the only rendered state in server-rendered apps. Condition setters write cookies for middleware and request a reload; provider-free SPA apps keep their cookie-backed behavior.

---
'@generaltranslation/react-core': patch
---

Render source content and log one deduplicated error, instead of crashing the server render, when a runtime translation request fails during a React Server Component render of `<T>` or `<Tx>` in development (for example a 401 from an invalid dev API key). Production behavior is unchanged: failed lookups already logged and fell back to source content.

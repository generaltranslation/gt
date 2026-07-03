---
"gt-react": patch
---

Remove RSC-only render internals from the `gt-react` react-server entry while keeping the compiler-injected internal translation exports available. The react-server declaration surface now also includes `RenderPipeline` and `RenderPreparedT`, matching the other `gt-react` entries.

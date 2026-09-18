---
'generaltranslation': patch
'gt': patch
'gt-sanity': patch
---

Consolidate CLI and Sanity request construction on the shared core API adapter, which now owns `createProject` and exposes raw project-info and job-status loaders for compatibility facades.

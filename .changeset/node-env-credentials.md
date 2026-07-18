---
'gt-node': patch
---

`initializeGT()` now reads `GT_PROJECT_ID`, `GT_API_KEY`, and `GT_DEV_API_KEY` from the environment as a fallback when they are not passed explicitly, matching the gt-node quickstart which sets these in `.env`. Explicit params still take precedence.

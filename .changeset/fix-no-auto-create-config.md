---
'@generaltranslation/cli': patch
---

Fix CLI silently creating `gt.config.json` when running commands like `gtx stage` in directories without a config file. Config creation is now only handled by `gtx init`/setup flows, not by `generateSettings`.

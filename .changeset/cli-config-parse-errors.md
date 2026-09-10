---
'gt': patch
---

fix: surface config file errors instead of silently ignoring them. A malformed `gt.config.json` (invalid JSON) was swallowed and treated as empty config, dropping every setting with no warning; an explicit `--config` path that doesn't exist was also ignored. Both now fail with a clear message and a non-zero exit code.

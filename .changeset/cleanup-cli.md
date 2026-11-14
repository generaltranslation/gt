---
'gt': patch
---

The `Settings` type no longer includes `version` or `description`, which no command reads. Both stay valid `gt.config.json` keys; read them from the config file instead of `settings.version` and `settings.description`.

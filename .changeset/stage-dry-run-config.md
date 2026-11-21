---
'gt': patch
---

`gt stage --dry-run` no longer writes `stageTranslations: true` to `gt.config.json`. A dry run only parses and validates the project, so it leaves the config file unchanged.

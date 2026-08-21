---
'gt': patch
---

gt init and gt configure now exit with an error when stdin is not an interactive terminal instead of silently exiting 0, and both accept a --yes flag that skips all prompts and applies the recommended defaults for CI and scripted runs. The --yes flow rejects an empty locales list, gt init now reads and writes the file passed with --config instead of always using gt.config.json, and when no package manager can be detected without an interactive terminal the CLI defaults to npm instead of prompting.

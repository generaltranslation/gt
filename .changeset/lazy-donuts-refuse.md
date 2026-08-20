---
'gt': patch
---

gt init and gt configure now exit with an error when stdin is not an interactive terminal instead of silently exiting 0, and both accept a --yes flag that skips all prompts and applies the recommended defaults for CI and scripted runs. When no package manager can be detected and stdin is not an interactive terminal, the CLI defaults to npm instead of prompting.

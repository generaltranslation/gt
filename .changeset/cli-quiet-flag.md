---
'gt': minor
---

Add a global `--quiet` / `-q` flag to the CLI that suppresses informational output. Under `--quiet` the CLI drops the info/step/success/spinner chatter and the ASCII banner in both the default and `GT_LOG_FORMAT=json` paths, while warnings, errors, exit codes, and command results stay the same. In JSON mode the remaining output keeps its shape: only info/debug/trace lines are dropped, and warn/error and above still print. The flag takes precedence over `GT_LOG_LEVEL` without lowering an already-more-restrictive level, and interactive prompts still run when a command genuinely needs input.

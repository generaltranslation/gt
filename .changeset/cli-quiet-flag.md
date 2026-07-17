---
'gt': minor
---

Add a global `--quiet` / `-q` flag to the CLI that suppresses informational output. Warnings, errors, exit codes, and machine-readable (`GT_LOG_FORMAT=json`) output are unchanged; only the info/step/success/spinner chatter and the ASCII banner are muted. The flag takes precedence over `GT_LOG_LEVEL` without lowering an already-more-restrictive level, and interactive prompts still run when a command genuinely needs input.

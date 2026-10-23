---
'gt': patch
---

Add `GT_LOG_FORMAT=agent`, which prints plain `[time] LEVEL: msg` lines, and use it by default in CI or when stdout is not a TTY. Set `GT_LOG_FORMAT=default` to keep the interactive output. The ASCII banner no longer prints when `GT_LOG_FORMAT` is `json` or `agent`.

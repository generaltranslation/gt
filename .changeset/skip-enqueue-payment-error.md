---
'gt': patch
'gtx-cli': patch
---

Add `--skip-on-payment-error` flag to the `translate`, `stage`, and `enqueue` CLI commands. When enabled, if the enqueue step fails due to insufficient account credits (HTTP 402), the command treats those files as skipped instead of exiting with an error. This prevents CI pipelines from breaking when the account runs out of credits. All other behavior (upload, download, post-processing) continues normally.

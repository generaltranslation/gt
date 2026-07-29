---
'gt-next': patch
---

Resolve the server build in worker runtimes by prioritizing `workerd` and `worker` export conditions ahead of `browser`, while preserving the React Server Components entrypoint's precedence.

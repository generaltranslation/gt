---
'gt-tanstack-start': patch
---

Resolve the server build on worker runtimes. The `.` export listed `browser` ahead of `import`, and Node's exports algorithm lets the target's own key order decide which condition wins, so worker runtimes — whose condition sets include `browser`, such as Cloudflare's `["workerd", "worker", "module", "browser"]` — loaded the browser build during SSR and crashed with `ReferenceError: document is not defined` when `initializeGT()` read `document.cookie`. `workerd` and `worker` now come first and take the server build, which installs the AsyncLocalStorage request condition store. Browsers still match `browser` and Node SSR still falls through to `import`, so no existing consumer changes.

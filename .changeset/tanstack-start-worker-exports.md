---
'gt-tanstack-start': patch
'gt-react': patch
---

Resolve the server build on worker runtimes. The `.` export listed `browser` ahead of `import`, and Node's exports algorithm lets the target's own key order decide which condition wins, so worker runtimes — whose condition sets include `browser`, such as Cloudflare's `["workerd", "worker", "module", "browser"]` — loaded the browser build during SSR. `gt-tanstack-start` crashed with `ReferenceError: document is not defined` when `initializeGT()` read `document.cookie`; `gt-react` silently handed back `BrowserGTProvider` and `initializeGTSRAClient`, so SSR ran on the isolate-global `BrowserConditionStore` shared across concurrent requests instead of the request-scoped store.

Both packages now list `workerd` and `worker` ahead of `browser` and resolve them to the server build. In `gt-react` they sit after `react-server`, so RSC runtimes on workerd keep the RSC build. Browsers still match `browser` and Node SSR still falls through to `import`, so no existing consumer changes.

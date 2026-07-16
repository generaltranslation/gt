---
'gt': patch
---

`gtx-cli translate` now scans root-level source files (e.g. `server.js` from the gt-node quickstart) by default. A root-level glob was added to `DEFAULT_SRC_PATTERNS` with root-scoped negations so config, build, and declaration files (`*.config.{js,cjs,mjs,ts,cts,mts}`, `*.d.ts`) at the project root are never wrapped. The existing `src`/`app`/`pages`/`components` directory patterns are unchanged.

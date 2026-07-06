---
"gt": patch
---

Move `@babel/types` from `devDependencies` to `dependencies`. The CLI imports `@babel/types` at runtime across its parsing/JSX-injection code, but it was only declared as a dev dependency and left external in the published build. On strict/isolated installs (e.g. pnpm on Vercel) consumers hit `ERR_MODULE_NOT_FOUND: Cannot find package '@babel/types'` when running `gtx-cli translate`. It now sits alongside the other `@babel/*` runtime dependencies so it is installed for consumers.

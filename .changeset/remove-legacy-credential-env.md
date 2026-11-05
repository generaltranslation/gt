---
'gt': major
'gt-next': major
'gt-node': major
---

Next.js and gt-node read credentials only from `GT_PROJECT_ID` and `GT_API_KEY`. In development, `GT_API_KEY` is also the hot-reload key.

- gt-next no longer reads `NEXT_PUBLIC_GT_PROJECT_ID` or `NEXT_PUBLIC_GT_DEV_API_KEY`. Rename them to `GT_PROJECT_ID` and `GT_API_KEY`, or rerun `npx gt init`.
- gt-node no longer reads `GT_DEV_API_KEY`. Rename it to `GT_API_KEY`. Passing `devApiKey` to `initializeGT()` still works.
- `gt init` saves `GT_PROJECT_ID` and `GT_API_KEY` for every framework without a client env prefix, and no longer accepts a `NEXT_PUBLIC_GT_DEV_API_KEY` or `NEXT_PUBLIC_GT_PROJECT_ID` as existing Next.js credentials. Frameworks with a client env prefix, such as Vite, still use `<PREFIX>GT_DEV_API_KEY` for now.

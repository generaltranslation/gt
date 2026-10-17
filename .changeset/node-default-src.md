---
'gt': patch
---

In gt-node projects, `gt translate`, `gt generate` and `gt validate` scan the project's JavaScript and TypeScript files by default, except `node_modules`, `dist`, `build`, `coverage`, `public` and test files, so a root-level `server.js` is translated without a `src` setting. The default scan skips folders and files the CLI cannot read.

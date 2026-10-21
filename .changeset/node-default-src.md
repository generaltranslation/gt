---
'gt': patch
---

In gt-node projects, `gt translate`, `gt generate` and `gt validate` scan the project's JavaScript and TypeScript files by default, except `node_modules`, so a root-level `server.js` is translated without a `src` setting. The default scan skips folders and files the CLI cannot read, and when it skips one, `gt generate` keeps every saved translation. A TypeScript file that imports a type and declares a `let` variable with the same name no longer stops the scan.

---
'gt-react': patch
'gt-next': patch
---

Convert the `index.types` entrypoints to declaration files and publish only their compiled `.d.ts` artifacts. This removes unreachable runtime bundles and sourcemaps from `gt-react` and `gt-next`.

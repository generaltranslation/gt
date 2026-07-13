---
'gt-react': patch
'gt-next': patch
---

Stop publishing unreachable `index.types` runtime bundles. The `index.types` entry only backs the exports map's `types` conditions, so only its declaration files are ever resolved; the runtime `.cjs`/`.mjs` artifacts (and sourcemaps) were dead weight in the published package (~179KB in gt-react, ~83KB in gt-next). They are now deleted after each build.

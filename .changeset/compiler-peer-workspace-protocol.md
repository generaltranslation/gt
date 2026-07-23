---
'gt-next': patch
---

Declare the internal `@generaltranslation/compiler` peer dependency with the `workspace:` protocol. The published range is unchanged (pnpm rewrites it to the real semver range at pack/publish); this removes the one bare internal version string, which changesets had to rewrite in `package.json` on every compiler bump and which could reference an unpublished version.

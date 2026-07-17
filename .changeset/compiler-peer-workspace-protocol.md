---
'gt-next': patch
---

Declare the internal `@generaltranslation/compiler` peer dependency with the `workspace:` protocol. The published range is unchanged (pnpm rewrites it to the real semver range at pack/publish); this removes the one hand-maintained internal version string, which drifted the lockfile on every compiler bump and could reference an unpublished version.

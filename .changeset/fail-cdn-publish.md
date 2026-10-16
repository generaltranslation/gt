---
'gt': patch
---

Exit with an error when translations cannot be published to the CDN, so a deploy stops instead of shipping without them. A command that only warned about a failed publish before, such as when the project has CDN delivery off, now fails. `gt init` now enables CDN delivery on a project it creates for CDN storage, and reminds you to check the setting on an existing project.

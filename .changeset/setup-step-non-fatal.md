---
'gt': patch
---

`gt translate` and `gt stage` no longer exit when the project setup request fails. A key without `project:context:write` gets a warning that names the permission, and the files are still sent for translation without generated context. `gt setup` now warns in the same cases instead of exiting with an error.

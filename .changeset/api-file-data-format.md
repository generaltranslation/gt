---
'@generaltranslation/api': minor
---

Source and translation uploads type a file's `dataFormat` as `FileDataFormat`, which is `DataFormat` without `MESSAGE_TREE`: a message tree's format is set per key, in a GTJSON file's `formatMetadata`. Context Management operations document the `project:context:read` and `project:context:write` scopes, which work on a project the group is assigned to.

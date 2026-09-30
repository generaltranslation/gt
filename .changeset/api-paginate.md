---
'@generaltranslation/api': minor
---

Add `paginate` to iterate every item of a list operation without handling cursors: `for await (const project of paginate(listProjects, { client })) {}`. The item type is inferred from the operation, the next page is requested only when iteration reaches it, and a failed page throws an `ApiError`.

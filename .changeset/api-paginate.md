---
'@generaltranslation/api': minor
---

Add `paginate` to iterate every item of a list operation without handling cursors: `for await (const project of paginate(listProjects, { client })) {}`. The item type is inferred from the operation, and the next page is requested only when iteration reaches it. `paginateWith(loadPage)` runs the same cursor loop with your own page loader.

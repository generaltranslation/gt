---
'gt': patch
---

When you're signed out, `gt init`'s "set up a project ID and hot-reload key" prompt now says it will sign you in to General Translation, and still defaults to Yes. A stored login that is obsolete or invalid is treated as signed out, so answering Yes signs you in again instead of failing. After creating a development key, setup names the key and the project (name and ID) it was created for; the key itself is never printed.

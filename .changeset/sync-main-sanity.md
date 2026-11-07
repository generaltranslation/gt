---
'gt-sanity': patch
---

From `main` (gt-sanity 4.0.33): `previewUrl` resolvers get the Sanity language id of the page as a second argument, `resolve(doc, { language })`, so each locale links to its own page, and imported translations send their page as their preview URL (#2653). Save Local Edits sends each uploaded translation's page as its preview URL (#2656).

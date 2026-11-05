---
'gt-sanity': patch
'generaltranslation': patch
'@generaltranslation/api': patch
---

`previewUrl` resolvers now get the Sanity language id of the page as a second argument, `resolve(doc, { language })`, so each locale links to its own page. Imported translations send their page as their preview URL, resolved from the document they were written to. Adds `updateFiles` to the API client and adapter for updating source files and translations.

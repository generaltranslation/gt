---
'gt-sanity': patch
---

Add a `previewUrl` option that sends General Translation the page each source document is shown on, so reviewers can open a string where it appears. Set `origin` to your site and `locations` to each document type's page, in the shape of `presentationTool`'s `resolve.locations` (the Presentation tool itself is not required); each document links to its first location in its published version.

---
'gt': patch
---

Extend the experimental static URL localizer to cover .html files (href attributes) alongside md and mdx, and lock in complex-path handling (query strings, anchors, trailing slashes, relative and external links) with an end-to-end fixture corpus. Defaults are unchanged; the feature stays gated behind experimentalLocalizeStaticUrls.

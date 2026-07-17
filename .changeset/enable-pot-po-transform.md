---
'gt': patch
---

Re-enable the POT -> PO file format transform test coverage. The `files.pot.transformationFormat: "PO"` option in `gt.config.json` shipped in #1248 with its tests skipped, waiting on platform support — which had already landed the same day (gt-cloud #2756). The 8 skipped tests now run and pass; no client code changes were needed.

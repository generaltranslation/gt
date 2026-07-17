---
'gt': patch
---

Re-enable the POT -> PO file format transform test coverage now that the API supports it. The client-side plumbing (`transformationFormat: "PO"` in `gt.config.json`, upload, enqueue, and download-to-`.po` mapping) shipped in #1248 behind skipped tests; the platform support landed the same day, so the tests now run and the transform is verified end-to-end.

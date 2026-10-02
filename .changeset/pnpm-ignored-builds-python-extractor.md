---
'@generaltranslation/python-extractor': patch
---

Bundle the tree-sitter Python grammar WASM instead of depending on `tree-sitter-python`, so installs no longer trigger its native build script (which pnpm 11 blocks by default).

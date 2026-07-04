---
"generaltranslation": patch
---

Vendor the FormatJS ICU AST printer so the ESM internal build no longer imports the CommonJS `printer.js` subpath, which Vite-based dev servers (e.g. TanStack Start) cannot load. Serialized output is byte-identical, so hashes are unchanged.

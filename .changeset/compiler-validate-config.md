---
'@generaltranslation/compiler': major
---

The compiler validates the `gt.config.json` it reads from the project root with the shared schema. A file with invalid values is now ignored with a warning that lists the invalid keys, as a file that is not valid JSON already was, instead of being used as is. A JSON syntax error no longer quotes the file content, which can hold credentials.

**Breaking:** `createInvalidGTConfigWarning` is no longer exported; the compiler formats its invalid-config warning itself. To format a similar message, use `createDiagnosticMessage()` from `generaltranslation/diagnostics`.

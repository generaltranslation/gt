---
'@generaltranslation/compiler': patch
---

Accept `msg([...])` arrays of static strings instead of failing the build checks. Each element is registered with the same hash as a single `msg()` call with the same options and with id `${id}.${index}`, matching the runtime. Arrays with derive content are skipped.

---
'@generaltranslation/paraglide-js': minor
---

Track only message usages, the only ones written to metadata files. Removes the runtime, server, registry and adapter targets (`runtimeTarget`, `serverTarget`, `registryTarget`, `adapterTargets`, `packageTarget`, `generatedFileTarget`) and a language's `elements` (`SourceElement`), which fed only usage fields that were never written. Metadata files are unchanged.

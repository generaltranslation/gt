---
'generaltranslation': minor
'gt': patch
---

Expose diagnostics through the public `generaltranslation/diagnostics` subpath and fail fast with a diagnostic when an unsupported model provider would otherwise be forwarded and rejected by the server. Migrate the CLI to the diagnostics subpath and API version export, and report invalid model-provider settings with the validation diagnostic.

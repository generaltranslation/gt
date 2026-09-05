---
'gt-next': patch
---

Support catch-all middleware paths and index dynamic route matching by segment.

Keep locale prefixes out of shared route parameters, preserve static route precedence across localized and shared paths, and support dotted parameter names.

Preserve the source route when switching from a locale alias and remove the target default-locale prefix correctly.

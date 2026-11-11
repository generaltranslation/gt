---
'gt-next': patch
---

Avoid adding an empty `experimental.swcPlugins` setting when the GT compiler is disabled, so Next.js does not list an unused SWC plugin experiment. Preserve application-configured plugins.

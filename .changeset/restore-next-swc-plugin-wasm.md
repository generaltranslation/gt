---
'gt-next': patch
---

Restore the SWC plugin `gt_swc_plugin.wasm` file to the published package. The `build` script now transpiles before building the SWC plugin, so tsdown's output cleaning no longer removes the plugin from `dist`.

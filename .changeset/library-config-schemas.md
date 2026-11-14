---
'gt-next': minor
'gt-react': minor
'gt-react-native': minor
'gt-tanstack-start': minor
'gt-vue': minor
'gt-svelte': minor
'gt-node': minor
---

Each package ships `config-schema.json`, the JSON Schema of a `gt.config.json` for a project that uses it: the gt CLI's keys and the package's own, and no others. Point `$schema` at it, as `gt init` does: `"$schema": "./node_modules/gt-next/config-schema.json"`.

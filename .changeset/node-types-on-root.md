---
'gt-node': major
---

`gt-node/types` is removed. Import its types from `gt-node`, except `TFunctionType`, which moved to `gt-node/compat` (see the dictionary API changeset).

`gt-node/internal` no longer re-exports `getI18nCache`, `setI18nCache` and `I18nCache`. Import them from `gt-i18n/internal`.

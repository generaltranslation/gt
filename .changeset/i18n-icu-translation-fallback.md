---
'gt-i18n': patch
---

An ICU translation that cannot be formatted now renders the source message, with the source locale's plural rules, instead of the raw ICU text, such as `{n, plural, one {# plik} few {# pliki}`. A warning is still logged.

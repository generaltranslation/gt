---
'@generaltranslation/format': major
'generaltranslation': major
---

`formatMessage` is named `formatIcu`: it formats an ICU string, which is not a message. A message is a message tree and its formats, and `formatMessageTree` formats that. `@generaltranslation/icu/parser` already names its string formatter `formatIcu`.

- `formatMessage(icu, options)` → `formatIcu(icu, options)`, and `GTIntl.formatMessage()` → `GTIntl.formatIcu()`.
- The data for its variables is passed as `values`, not `variables`, as `formatMessageTree` takes it. In `generaltranslation`: `formatIcu('Hi {name}', { values: { name: 'Ada' } })`. In `@generaltranslation/format`, which applies no defaults, also pass `locales` and `timeZone`.
- The `FormatVariables` type is `FormatValues`.
- It no longer takes `dataFormat`. With `dataFormat: 'STRING'` it returned the text as it was; a string that is not ICU needs no formatting, so do not call it.

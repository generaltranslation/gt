---
'@generaltranslation/format': patch
---

`getRegionProperties()` and `GTIntl.getRegionProperties()` keep the computed region name and emoji when a custom mapping entry sets them to `undefined`. With `{ US: { name: undefined } }`, the result's `name` was `undefined` although it is typed `string`; it is now the display name, `United States`. Same for `emoji`.

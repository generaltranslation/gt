---
'gt-vue': minor
'@generaltranslation/react-core': patch
---

- gt-vue's `<Num>`, `<Currency>` and `<DateTime>` format through `generaltranslation`'s formatters, as gt-react's do. They reuse one `Intl` formatter per locale and options, where they built a new one on every render, and they print what gt-react prints: Latin digits and the Gregorian calendar, so `<Num :value="1234.5"/>` in `ar-EG` is `1,234.5`, not `١٬٢٣٤٫٥`. A `<DateTime>` without a `timeZone` is still in the host's.
- The region selector builds one `Intl.Collator` to sort its regions, not one per comparison.

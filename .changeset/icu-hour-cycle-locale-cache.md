---
'@generaltranslation/icu': patch
---

- `j` in a date skeleton is the locale's hour. The locale's hour cycle is now read once per locale, not for every message: `{d, time, ::jm}` formats in about 2 µs, where reading the cycle took about 45 µs each time. It also honors a region override like `en-u-rg-gbzzzz` on engines that have dropped `Intl.Locale`'s `hourCycles` getter for `getHourCycles()`, such as Node 26: `{d, time, ::j}` at 7:03 is `07`, not `7 AM`.
- Each locale of a list, which `LocaleConfig` passes for every message, is resolved once, as a single locale already was.

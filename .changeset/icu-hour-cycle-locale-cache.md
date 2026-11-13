---
'@generaltranslation/icu': patch
---

- The locale's hour, `j` in a date skeleton, honors a region override like `en-u-rg-gbzzzz` on engines that have dropped `Intl.Locale`'s `hourCycles` getter for `getHourCycles()`, such as Node 26: `{d, time, ::j}` at 7:03 is `07`, not `7 AM`. Where an engine has neither, the hour cycle comes from a `DateTimeFormat`, now built once per locale instead of once per message.
- A list of locales, which `LocaleConfig` passes for every message, is resolved once, as a single locale already was.

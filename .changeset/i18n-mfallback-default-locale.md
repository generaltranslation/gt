---
'gt-i18n': patch
---

`mFallback` formats in the configured default locale. It used the library default, `en`, even after `initializeGT()`: with `defaultLocale: 'de'`, `mFallback(msg`${num({ price: 1234.5 })}`)` returned `1,234.5` where `m` with i18n disabled returns `1.234,5`. Without a config it still formats in `en`.

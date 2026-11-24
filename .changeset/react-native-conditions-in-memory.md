---
'gt-react-native': patch
---

On Android, a locale change no longer waits for native storage. Native storage is written asynchronously there, and the locale, region and `enableI18n` flag were read back from it right after each write, so `<GTProvider>` could render the previous locale after `setLocale()` or a new `locale` prop. They are now kept in memory, and native storage only persists them between launches.

`<GTProvider>` also renders the conditions it loaded translations for, not the ones a setter just asked for:

- With a `locale`, `region` or `enableI18n` prop, calling the matching setter no longer changes what `useLocale()`, `useRegion()` or `useEnableI18n()` return.
- `setRegion(undefined)` stays cleared when native storage writes late; it used to read the old region back and save it again.

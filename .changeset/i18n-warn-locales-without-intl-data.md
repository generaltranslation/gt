---
'gt-i18n': minor
---

In development, initializing the config warns once when the runtime's `Intl` has no number or date data for a configured locale. `Intl` formats such a locale in the browser's or the host's locale without an error; the warning names the locales and the two fixes, an `Intl` polyfill or a `locales` list.

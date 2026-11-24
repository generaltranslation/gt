---
'gt-i18n': minor
---

Add `gt-i18n/standalone`, which sets gt-i18n up on its own for a program that serves one user in one locale at a time, such as a script, a worker or an Electron main process:

```ts
import { t } from 'gt-i18n';
import { initializeGT, setLocale, onLocaleChange } from 'gt-i18n/standalone';

await initializeGT({ ...gtConfig, loadTranslations, locale: 'de' });
t`Save`; // 'Speichern'
```

- `initializeGT()` resolves once the starting locale's translations have loaded, so `t` and `m` from `gt-i18n` are translated from the first call. When they fail to load, it warns and the program starts in source text; a later `setLocale()` to that locale loads them and runs the listeners. Translations never expire here, so `cacheExpiryTime` is ignored.
- `setLocale(locale)` changes the locale once its translations have loaded. When calls overlap, the latest one wins. When the translations fail to load, the promise rejects and the locale stays as it was, so a later call can try again.
- `onLocaleChange(listener)` runs a function after each change, for text that was already produced, such as a native menu, and returns a function that stops the calls. A listener that throws is reported, and the others still run.

A server that answers requests in several locales still uses gt-node.

`gt-i18n` exports `isMsg(value)`: it tells whether a value is the object a tagged `msg` returns for a message with variables or options, for code that passes messages through a schema or `postMessage`. A message of plain text is a string.

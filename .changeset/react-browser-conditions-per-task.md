---
'gt-react': patch
---

In a client-rendered app, `t` and every hook outside a provider looked up the locale and the `enableI18n` cookie again on each call: the config, each cookie name, each cached cookie and the navigator's locales, to find them unchanged. The browser's condition store now resolves both once, and each call checks only that the task's cookies and navigator locales are the ones they were resolved from. `document.cookie` is read once per task for every cookie, where each cookie name read it again, and is parsed again only when it has changed. When a change is seen stays the same: a cookie changed by other code is seen in the next task, and one that gt-react writes is seen at once.

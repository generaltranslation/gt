---
'gt-react': patch
---

In a client-rendered app, `t` and every hook outside a provider read `document.cookie` and `navigator.languages` and matched them to a configured locale on each call, which cost several times more than rendering the message. The browser now reads them once per task and matches the locales again only when they change. A cookie changed by other code is seen in the next task.

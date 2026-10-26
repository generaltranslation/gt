---
'gt-tanstack-start': patch
---

With `localeRouting`, SPA builds now move a visitor onto their locale's URL, as the server redirects them in server-rendered apps. A static host can't redirect, so a visitor whose locale came from their cookie or browser languages used to stay on the unprefixed URL.

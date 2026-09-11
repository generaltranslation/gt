---
'gt-next': patch
---

Reload the browser document when changing locales with locale routing enabled so a fallback to the current page resets the client locale to the server's chosen locale. This temporarily replaces server-component refreshes for routed provider updates; a full reload resets transient client state.

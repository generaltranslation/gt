---
"gt-next": patch
"gt-react": patch
---

Use a full browser reload for routed locale changes so middleware redirects preserve coherent page content when navigating Back and Forward. Like the existing default-locale switch, switching to another locale now resets in-memory client state. Same-locale updates and pages without locale routing still refresh server components.

Refresh the browser condition store’s callback when server props provide a new handler, so subsequent locale switches use the currently rendered locale after client navigation.

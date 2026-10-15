---
'gt-react': patch
---

Keep a visitor's locale choice when the browser restores an older page with Back or Forward. The provider reloads that page instead of writing the page's older locale over the locale cookie, so the server renders it with the visitor's choice, or with the locale in its URL.

---
'gt-next': patch
---

Fix the SWC plugin failing to load on Next.js 16.4 and later. gt-next now ships two builds of the plugin, one for Next.js 16.4 and later and one for Next.js 16.1 through 16.3, and picks the build that matches the installed Next.js version.

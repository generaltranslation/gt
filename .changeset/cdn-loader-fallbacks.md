---
'gt': patch
---

When `gt configure --storage cdn` leaves more than one `loadTranslations` file in a Next.js app, the manual action now names all of them. gt-next falls back to the next file when one is deleted, so deleting only the first one kept translations loading locally.

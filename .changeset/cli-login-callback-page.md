---
'gt': patch
---

Restyle the page `gt login` shows in the browser after the loopback callback to match the dashboard's auth plate, centered on the plain ground: the GT mark, a heading with a status glyph, a lede, and a note naming the signed-in account. Nothing loads from the network. A denied request and a failed exchange get their own pages, and both say to run `npx gt login` again.

`gt login` returns to the shell as soon as the browser's callback is answered: a repeated callback request no longer holds a keep-alive socket open for the five second timeout. A caller's AbortSignal now cancels the browser flow's token exchange and account lookup, reported as a cancellation.

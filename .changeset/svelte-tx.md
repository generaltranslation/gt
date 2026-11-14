---
'gt-svelte': minor
---

Add `tx()` for server code, such as SvelteKit `load` functions and endpoints: `await tx('Your order has shipped', { $locale })` translates a string at runtime with the API key from the server's environment.

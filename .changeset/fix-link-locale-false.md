---
"gt-next": patch
---

Stop forwarding `locale={false}` from `gt-next/link` to the underlying Next.js link after localizing the href.

This avoids React DOM warnings in newer Next.js versions where the control prop can reach the rendered anchor.

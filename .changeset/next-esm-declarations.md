---
'gt-next': patch
---

Add ESM declarations (`.d.mts`) for the `import` condition of each typed export, so consumers using TypeScript `moduleResolution` `node16` or `nodenext` get ESM types instead of CommonJS types (fixes the "masquerading as CJS" (FalseCJS) problem). The default import of `gt-next/link` is now typed as the `Link` component in ESM files.

---
"gt-next": patch
---

Ship a dual ESM/CJS build for `gt-next` and add `import` export conditions.

Previously `gt-next` was published as CJS only (no `import` condition), so bundlers resolved the entire gt dependency graph (`gt-react`, `@generaltranslation/react-core`, `generaltranslation`, `gt-i18n`, `@generaltranslation/format`) through the `require` condition. That forced CJS variants onto the client, which cannot be tree-shaken — shipping `gt-next`'s own server/error code and unused dependency exports to the browser.

`gt-next` now emits unbundled `.mjs` output alongside the existing `.js` output, and every `exports` subpath exposes an `import` condition. Bundlers now resolve the gt graph as ESM, enabling tree-shaking across all gt packages. Measured on a real Next.js app, this cuts gt's total client bundle by ~19% gzip (≈96 kB → ≈78 kB) with no API changes.

The ESM build sets `polyfillRequire: false` so rolldown does not inject a `createRequire`-from-`node:module` shim (server-only `require()` calls are provided `require` by the bundler), and marks the `index.rsc`/`index.client` entrypoints as having side effects so their top-level initialization is not tree-shaken away.

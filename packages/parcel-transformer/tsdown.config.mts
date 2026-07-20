import { defineConfig } from 'tsdown';

// Parcel loads plugins via dynamic import(), so this package ships ESM only.
// That also lets the entry use import.meta.url (see src/index.ts) without a
// CommonJS shim.
//
// No source maps are emitted, matching the other GT build packages. A top-level
// `sourcemap: true` also made rolldown stamp a `sourceMappingURL` comment into
// index.d.mts that pointed at a declaration map it never wrote, leaving a
// dangling reference in the published types. The per-dts sourcemap toggle does
// not suppress that output-level comment, so maps are left off entirely.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  deps: { onlyBundle: false },
  outputOptions: { exports: 'named' },
});

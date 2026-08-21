import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

// Dual CJS+ESM (the repo norm). react/react-dom and the rrweb runtime are peers —
// keep them external so the host app supplies one copy.
// Two entries: '.' (the client recorder, carries a 'use client' directive) and
// './harvest' (a pure browser function, no React / no directive).
export default defineConfig(
  createTsdownConfig(['src/index.ts', 'src/harvest.ts'], {
    neverBundle: [
      /^react$/,
      /^react\//,
      /^react-dom$/,
      /^react-dom\//,
      /^@rrweb\/record$/,
      /^@rrweb\/record\//,
      /^@rrweb\/types$/,
      /^@rrweb\/types\//,
    ],
  })
);

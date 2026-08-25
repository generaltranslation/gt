import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

// Dual CJS+ESM (the repo norm). react/react-dom and the rrweb runtime are peers —
// keep them external so the host app supplies one copy. morphdom (used by the
// replayer's no-rebuild scrub) is small and NOT a peer, so it's bundled in.
// Three entries: '.' (the client recorder, carries a 'use client' directive),
// './harvest' (a pure browser function, no React / no directive), and './replay'
// (the client replayer: framework-agnostic core + a thin React wrapper).
export default defineConfig(
  createTsdownConfig(['src/index.ts', 'src/harvest.ts', 'src/replay.ts'], {
    neverBundle: [
      /^react$/,
      /^react\//,
      /^react-dom$/,
      /^react-dom\//,
      /^@rrweb\/record$/,
      /^@rrweb\/record\//,
      /^@rrweb\/replay$/,
      /^@rrweb\/replay\//,
      /^@rrweb\/types$/,
      /^@rrweb\/types\//,
    ],
  })
);

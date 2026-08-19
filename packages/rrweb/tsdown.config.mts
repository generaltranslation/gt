import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

// Dual CJS+ESM (the repo norm). react/react-dom are peers — keep them external so
// the host app supplies one copy.
export default defineConfig(
  createTsdownConfig(['src/index.ts'], {
    neverBundle: [/^react$/, /^react\//, /^react-dom$/, /^react-dom\//],
  })
);

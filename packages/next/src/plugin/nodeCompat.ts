import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The `gt-next/config` entry runs in plain Node (next.config is loaded, not
// bundled), so the ESM build (`dist/config.mjs`) has no CJS `require` or
// `__dirname` and the build's `polyfillRequire: false` means rolldown won't
// inject them. Derive both here; only import this module from the config
// graph — `createRequire` from `node:module` breaks client bundlers.

export const nodeRequire: NodeJS.Require =
  typeof require === 'function' ? require : createRequire(import.meta.url);

const nodeCompatDirname: string =
  typeof __dirname === 'string'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// This module is emitted to <dist>/plugin/, one level below dist assets like
// gt_swc_plugin.wasm, in both the CJS and ESM builds.
export const distDir: string = path.resolve(nodeCompatDirname, '..');

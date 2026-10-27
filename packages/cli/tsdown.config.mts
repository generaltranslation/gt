import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownUnbundleConfig({
    format: 'esm',
    dts: true,
    // mdast types come from devDependency @types/mdast; keep the bare import tsc emitted.
    deps: { neverBundle: ['mdast'] },
  })
);

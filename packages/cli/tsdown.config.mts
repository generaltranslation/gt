import { defineConfig } from 'tsdown';
import {
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownUnbundleConfig({
      format: 'esm',
      dts: true,
      // mdast types come from devDependency @types/mdast; keep the bare import tsc emitted.
      deps: { neverBundle: ['mdast'] },
    }),
    { profile: 'esm-only' }
  )
);

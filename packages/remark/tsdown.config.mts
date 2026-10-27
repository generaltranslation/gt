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
      // mdast is types-only (@types/mdast), so nothing marks it external and
      // the declaration bundler would otherwise inline it into dist.
      deps: { neverBundle: ['mdast'] },
    }),
    { profile: 'esm-only' }
  )
);

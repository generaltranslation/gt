import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownUnbundleConfig({
    format: 'esm',
    dts: true,
    // mdast is types-only (@types/mdast), so nothing marks it external and
    // the declaration bundler would otherwise inline it into dist.
    deps: { neverBundle: ['mdast'] },
  })
);

import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownUnbundleConfig({
    format: 'esm',
  })
);

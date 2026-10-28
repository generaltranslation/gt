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
    }),
    { profile: 'esm-only' }
  )
);

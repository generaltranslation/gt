import { defineConfig } from 'tsdown';
import {
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownUnbundleConfig({
      format: 'cjs',
      dts: true,
      outputOptions: {
        exports: 'named',
      },
    })
  )
);

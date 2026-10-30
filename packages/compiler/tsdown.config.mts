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
      // A hand-written ambient module declaration (no runtime code)
      copy: [
        {
          from: 'src/experimental/locale-twins-manifest.d.ts',
          to: 'dist/experimental',
        },
      ],
      outputOptions: {
        exports: 'named',
      },
    })
  )
);

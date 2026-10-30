import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownConfig([
      'src/index.ts',
      'src/internal-compat.ts',
      'src/internal-cookies.ts',
      'src/internal-string.ts',
      'src/internal.ts',
    ]).map((config) => ({
      ...config,
      // Keep decodeOptions out of the shared runtime chunk so importing it from the root stays small (gt-vue).
      outputOptions: {
        codeSplitting: {
          groups: [
            { name: 'decodeOptions', test: /msg[\\/]decodeOptions\.ts$/ },
          ],
        },
      },
    }))
  )
);

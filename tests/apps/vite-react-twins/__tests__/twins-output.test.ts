import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { defineLocaleTwinsBuildSuite } from '../../test-apps-e2e/locale-twins/buildSuite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

defineLocaleTwinsBuildSuite(
  { describe, it, beforeAll, afterAll },
  {
    root: appDir,
    translationsDir: path.join(appDir, 'src/_gt'),
    async build({ outDir, translationsDir }) {
      // vite.config.ts reads the translations directory from the environment;
      // Vite loads the config file natively, as `vite build` does.
      process.env.GT_TWINS_TRANSLATIONS_DIR = translationsDir;
      try {
        await build({
          configFile: path.join(appDir, 'vite.config.ts'),
          build: { outDir, emptyOutDir: true },
          logLevel: 'warn',
        });
      } finally {
        delete process.env.GT_TWINS_TRANSLATIONS_DIR;
      }
    },
  }
);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defineLocaleTwinsBuildSuite } from '../../test-apps-e2e/locale-twins/buildSuite';
import { listFiles } from '../../test-apps-e2e/locale-twins/twinOutput';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite8AppDir = path.resolve(appDir, '../vite-react-twins');

// This app is the Vite 7 (Rollup) build of the vite-react-twins app.
describe('vite7-react-twins sources', () => {
  it('match vite-react-twins', () => {
    const sharedFiles = [
      ...listFiles(path.join(vite8AppDir, 'src')).map((file) => `src/${file}`),
      'gt.config.json',
      'index.html',
      'vite.config.ts',
    ];
    for (const file of sharedFiles) {
      expect(
        fs.readFileSync(path.join(appDir, file), 'utf8'),
        `${file} differs from vite-react-twins`
      ).toBe(fs.readFileSync(path.join(vite8AppDir, file), 'utf8'));
    }
    expect(listFiles(path.join(appDir, 'src'))).toEqual(
      listFiles(path.join(vite8AppDir, 'src'))
    );
  });
});

defineLocaleTwinsBuildSuite(
  { describe, it, beforeAll, afterAll },
  {
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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuilder } from 'vite';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { defineLocaleTwinsBuildSuite } from '../../test-apps-e2e/locale-twins/buildSuite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpPaths: string[] = [];

afterAll(() => {
  for (const tmpPath of tmpPaths)
    fs.rmSync(tmpPath, { recursive: true, force: true });
});

/**
 * gt.config.json is also part of the client build (gtTanstackStart() serves
 * it to the browser), so every build in a run reads the same copy: its
 * files.gt.output names one directory, which gets the translation files of
 * each build. A different config per build would change every locale's twins.
 */
const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-twins-config-'));
tmpPaths.push(configDir);
const configTranslationsDir = path.join(configDir, '_gt');
const configFile = path.join(configDir, 'gt.config.json');
const config = JSON.parse(
  fs.readFileSync(path.join(appDir, 'gt.config.json'), 'utf8')
);
config.files.gt.output = path.join(configTranslationsDir, '[locale].json');
fs.writeFileSync(configFile, JSON.stringify(config));

/** Points the shared config at a copy of `translationsDir`. */
function useTranslations(translationsDir: string): void {
  fs.rmSync(configTranslationsDir, { recursive: true, force: true });
  fs.cpSync(translationsDir, configTranslationsDir, { recursive: true });
}

defineLocaleTwinsBuildSuite(
  { describe, it, beforeAll, afterAll },
  {
    translationsDir: path.join(appDir, 'src/_gt'),
    // TanStack Start renders documents per request; there is no static one.
    documents: [],
    async build({ outDir, translationsDir }) {
      // vite.config.ts reads the gt.config.json path from the environment;
      // Vite loads the config file natively, as `vite build` does. The client
      // goes to `outDir`; the server build (which inlines the twin manifest)
      // goes next to it.
      const serverDir = `${outDir}-server`;
      tmpPaths.push(serverDir);
      useTranslations(translationsDir);
      process.env.GT_TWINS_CONFIG = configFile;
      try {
        const builder = await createBuilder({
          configFile: path.join(appDir, 'vite.config.ts'),
          environments: {
            client: { build: { outDir, emptyOutDir: true } },
            ssr: { build: { outDir: serverDir, emptyOutDir: true } },
          },
          logLevel: 'warn',
        });
        await builder.buildApp();
      } finally {
        delete process.env.GT_TWINS_CONFIG;
      }
    },
  }
);

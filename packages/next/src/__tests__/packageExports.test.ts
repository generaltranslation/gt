import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const distInitGTServerPath = join(packageRoot, 'dist/setup/initGT.server.mjs');
const distConfigPath = join(packageRoot, 'dist/config.mjs');

describe('gt-next package exports', () => {
  it('uses RSC-specific declarations for the react-server condition', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as {
      exports: {
        '.': {
          'react-server': {
            types?: string;
          };
          types: string;
        };
      };
    };

    expect(packageJson.exports['.']['react-server'].types).toBe(
      './dist/index.rsc.d.ts'
    );
    expect(packageJson.exports['.'].types).toBe('./dist/index.types.d.ts');
  });

  const distIt = existsSync(distInitGTServerPath) ? it : it.skip;

  distIt('keeps custom request functions visible to bundler aliases', () => {
    const serverBuild = readFileSync(distInitGTServerPath, 'utf8');

    expect(serverBuild).toContain('gt-next/internal/_getLocale');
    expect(serverBuild).toContain('gt-next/internal/_getRegion');
    expect(serverBuild).not.toContain('createRequire');
    expect(serverBuild).not.toContain('serverRequire');
  });

  distIt('initializes custom resolvers from the ESM server build', () => {
    const script = `
      import { initializeGTServer } from ${JSON.stringify(
        pathToFileURL(distInitGTServerPath).href
      )};

      initializeGTServer({
        i18nConfigParams: {
          defaultLocale: 'en',
          locales: ['en'],
        },
        nextI18nCacheParams: {
          defaultLocale: 'en',
          locales: ['en'],
        },
      });

      console.log('ok');
    `;

    for (const envFlag of [
      '_GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED',
      '_GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED',
    ]) {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', script],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            _GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED: 'false',
            _GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED: 'false',
            [envFlag]: 'true',
          },
        }
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('ok');
    }
  });

  const distConfigIt = existsSync(distConfigPath) ? it : it.skip;

  distConfigIt('loads the config entry from Node ESM', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { withGTConfig } from 'gt-next/config';

          if (typeof withGTConfig !== 'function') {
            throw new Error('withGTConfig export not found');
          }

          console.log('ok');
        `,
      ],
      {
        cwd: packageRoot,
        encoding: 'utf8',
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('ok');
  });
});

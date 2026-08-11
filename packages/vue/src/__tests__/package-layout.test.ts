import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as gtVue from '../index';

const sourceDirectories = [
  '__tests__',
  'components',
  'composables',
  'messages',
  'rendering',
  'runtime',
  'types',
];

describe('gt-vue package layout', () => {
  it('keeps every source directory under src', () => {
    const src = fileURLToPath(new URL('..', import.meta.url));
    expect(readdirSync(src).sort()).toEqual(
      [...sourceDirectories, 'index.ts'].sort()
    );
    expect(
      sourceDirectories.filter((directory) =>
        existsSync(new URL(`../../${directory}`, import.meta.url))
      )
    ).toEqual([]);
  });

  it('exports the complete runtime API from the root entry point', () => {
    expect(Object.keys(gtVue).sort()).toEqual(
      [
        'Branch',
        'Currency',
        'DateTime',
        'Num',
        'Plural',
        'T',
        'Var',
        'createGT',
        'msg',
        'useGT',
        'useLocale',
        'useMessages',
        'useSetLocale',
      ].sort()
    );
  });

  it('accepts React rich-wire literals through TranslationCatalog', () => {
    const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
    const fixtureDirectory = mkdtempSync(
      join(packageRoot, '.gt-vue-typecheck-')
    );
    const fixture = join(fixtureDirectory, 'catalog.ts');
    writeFileSync(
      fixture,
      `
        import type { TranslationCatalog } from '../src/index.js';

        const catalog = {
          rootFalse: false,
          rootTrue: true,
          rootNull: null,
          nestedFalse: { t: 'div', c: false },
          nestedTrue: { t: 'div', c: true },
          nestedNull: { t: 'div', c: { t: 'span', c: null } },
          branches: {
            t: 'Branch',
            d: { t: 'b', b: { active: true, inactive: false, empty: null } },
          },
        } satisfies TranslationCatalog;

        // @ts-expect-error React omits boolean and null values inside arrays.
        const invalidArray = [false] satisfies TranslationCatalog[string];

        void catalog;
        void invalidArray;
      `
    );

    try {
      execFileSync(
        process.execPath,
        [
          join(packageRoot, 'node_modules/typescript/bin/tsc'),
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--module',
          'ESNext',
          '--moduleResolution',
          'Bundler',
          '--target',
          'ES2022',
          fixture,
        ],
        { stdio: 'pipe' }
      );
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});

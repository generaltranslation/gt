import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
        'initializeGTSPA',
        'msg',
        't',
        'useGT',
        'useLocale',
        'useMessages',
        'useSetLocale',
      ].sort()
    );
  });
});

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as gtVue from '../src';

describe('gt-vue package layout', () => {
  it('reserves src for package entry points', () => {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    expect(readdirSync(src).sort()).toEqual(['index.ts']);
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
});

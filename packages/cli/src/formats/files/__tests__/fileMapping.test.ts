import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createFileMapping } from '../fileMapping.js';

describe('createFileMapping', () => {
  it('uses the transformation format extension for mapped output files', () => {
    const sourcePath = path.resolve('locales/en/messages.pot');
    const placeholderPath = path.resolve('locales/[locale]/messages.pot');

    const mapping = createFileMapping(
      { pot: [sourcePath] },
      { pot: [placeholderPath] },
      {},
      { pot: 'PO' },
      ['fr'],
      'en'
    );

    expect(mapping.fr['locales/en/messages.pot']).toBe(
      'locales/fr/messages.po'
    );
  });
});

import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { createFileMapping } from '../fileMapping.js';
import { TEMPLATE_FILE_NAME } from '../../../utils/constants.js';

describe('createFileMapping', () => {
  it('uses a relative output path for GTJSON template files', () => {
    const outputPath = path.resolve('public/gt/[locale].json');

    const mapping = createFileMapping(
      {},
      { gt: outputPath },
      {},
      {},
      ['es'],
      'en'
    );

    expect(mapping.es[TEMPLATE_FILE_NAME]).toBe('public/gt/es.json');
  });

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

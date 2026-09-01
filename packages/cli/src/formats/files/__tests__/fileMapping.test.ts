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

  it('maps every locale of an xcstrings catalog to the same shared file', () => {
    // Catalog include patterns carry no [locale], so the placeholder path
    // equals the source path and download merges target the one on-disk file
    const catalogPath = path.resolve('Cascade/Localizable.xcstrings');

    const mapping = createFileMapping(
      { xcstrings: [catalogPath] },
      { xcstrings: [catalogPath] },
      {},
      {},
      ['es', 'fr'],
      'en'
    );

    expect(mapping.es['Cascade/Localizable.xcstrings']).toBe(
      'Cascade/Localizable.xcstrings'
    );
    expect(mapping.fr['Cascade/Localizable.xcstrings']).toBe(
      'Cascade/Localizable.xcstrings'
    );
  });

  describe('non-canonical locale tags', () => {
    // A locale written as "fr-ca" canonicalizes to "fr-CA". Everything that
    // names a path must use the tag as configured, because [locale]
    // substitution and static URL localization both use it verbatim. If
    // {locale} canonicalized here, content would be written to docs/fr-CA/
    // while links pointed at /docs/fr-ca/.
    const mapWith = (transform: { match: string; replace: string }) =>
      createFileMapping(
        { mdx: [path.resolve('docs/guide.mdx')] },
        { mdx: [path.resolve('docs/guide.mdx')] },
        { mdx: transform },
        {},
        ['fr-ca', 'ja-jp'],
        'en'
      );

    it('uses the configured tag, not the canonical one, for object transforms', () => {
      const mapping = mapWith({
        match: '^docs/(.*)$',
        replace: 'docs/{locale}/$1',
      });

      expect(mapping['fr-ca']['docs/guide.mdx']).toBe('docs/fr-ca/guide.mdx');
      expect(mapping['ja-jp']['docs/guide.mdx']).toBe('docs/ja-jp/guide.mdx');
    });

    it('uses the configured tag for array transforms', () => {
      const mapping = createFileMapping(
        { json: [path.resolve('docs/oas/api.json')] },
        { json: [path.resolve('docs/oas/api.json')] },
        {
          json: [{ match: '^docs/oas/(.*)$', replace: 'docs/{locale}/oas/$1' }],
        },
        {},
        ['fr-ca'],
        'en'
      );

      expect(mapping['fr-ca']['docs/oas/api.json']).toBe(
        'docs/fr-ca/oas/api.json'
      );
    });

    it('agrees with the [locale] substitution used by the string transform form', () => {
      // The string form of transform has always substituted [locale]
      // verbatim. The object form must produce the same directory.
      const objectForm = mapWith({
        match: '^docs/(.*)$',
        replace: 'docs/{locale}/$1',
      });
      const stringForm = createFileMapping(
        { mdx: [path.resolve('docs/guide.mdx')] },
        { mdx: [path.resolve('docs/[locale]/guide.mdx')] },
        {},
        {},
        ['fr-ca'],
        'en'
      );

      expect(objectForm['fr-ca']['docs/guide.mdx']).toBe(
        stringForm['fr-ca']['docs/guide.mdx']
      );
    });

    it('leaves already-canonical tags unchanged', () => {
      const mapping = createFileMapping(
        { mdx: [path.resolve('docs/guide.mdx')] },
        { mdx: [path.resolve('docs/guide.mdx')] },
        { mdx: { match: '^docs/(.*)$', replace: 'docs/{locale}/$1' } },
        {},
        ['fr-CA', 'ja'],
        'en'
      );

      expect(mapping['fr-CA']['docs/guide.mdx']).toBe('docs/fr-CA/guide.mdx');
      expect(mapping['ja']['docs/guide.mdx']).toBe('docs/ja/guide.mdx');
    });

    it('still exposes canonical values via explicitly-named properties', () => {
      const mapping = mapWith({
        match: '^docs/(.*)$',
        replace: 'docs/{languageCode}-{regionCode}/$1',
      });

      expect(mapping['fr-ca']['docs/guide.mdx']).toBe('docs/fr-CA/guide.mdx');
    });
  });
});

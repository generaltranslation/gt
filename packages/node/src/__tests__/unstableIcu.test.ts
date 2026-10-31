import '../unstable-icu';
import { hashMessageTree } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { initializeGT } from '../setup/initializeGT';
import { withGT } from '../setup/withGT';
import { getGT, n, part, plural } from '../unstable';

// Catalog keys are the source trees' hashes, as `gt generate` writes them.
const filesTree = [
  ['count', 'plural', { one: [0, ' file'], other: [0, ' files'] }],
];

describe('gt-node/unstable/icu', () => {
  it('translates a catalog of ICU strings', async () => {
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: (locale: string) =>
        locale === 'fr'
          ? {
              [hashMessageTree(filesTree)]:
                '{count, plural, one {# fichier} other {# fichiers}}',
            }
          : {},
    });
    const count = 3;

    const result = await withGT('fr', async () => {
      const gt = await getGT();
      return gt`${plural({ count }, { one: part`${n} file`, other: part`${n} files` })}`;
    });

    expect(result).toBe('3 fichiers');
  });
});

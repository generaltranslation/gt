import { hashMessageTree } from 'generaltranslation/id';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeGT } from '../setup/initializeGT';
import { withGT } from '../setup/withGT';
import { getGT, t } from '../unstable';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = ['Save'];
const frenchTranslations = {
  [hashMessageTree(saveTree)]: ['Enregistrer'],
};

describe.sequential('gt-node/unstable', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: (locale: string) =>
        // Message trees are stored as JSON values, not strings.
        (locale === 'fr' ? frenchTranslations : {}) as Record<string, string>,
    });
  });

  it('translates with getGT() and t inside withGT()', async () => {
    const result = await withGT('fr', async () => {
      const gt = await getGT();
      return [gt`Save`, t`Save`];
    });

    expect(result).toEqual(['Enregistrer', 'Enregistrer']);
    expect(await withGT('en', async () => (await getGT())`Save`)).toBe('Save');
  });
});

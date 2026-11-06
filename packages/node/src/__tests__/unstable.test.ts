import { hashSource } from 'generaltranslation/id';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeGT } from '../setup/initializeGT';
import { withGT } from '../setup/withGT';
import { getGT, getMessages, msg } from '../unstable';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = ['Save'];
const frenchTranslations = {
  [hashSource({ source: saveTree, dataFormat: 'ICU_TREE' })]: ['Enregistrer'],
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

  it('translates with getGT() inside withGT()', async () => {
    const result = await withGT('fr', async () => (await getGT())`Save`);

    expect(result).toBe('Enregistrer');
    expect(await withGT('en', async () => (await getGT())`Save`)).toBe('Save');
  });

  it('renders msg() messages with getMessages() inside withGT()', async () => {
    const save = msg({ maxChars: 20 })`Save`;
    const translate = async () => (await getMessages())(msg('Save'));

    expect(await withGT('fr', translate)).toBe('Enregistrer');
    expect(await withGT('en', translate)).toBe('Save');
    // Options change the key, so this one has no translation.
    expect(await withGT('fr', async () => (await getMessages())(save))).toBe(
      'Save'
    );
  });
});

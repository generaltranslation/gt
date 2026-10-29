import { hashMessageTree } from 'generaltranslation/id';
import {
  I18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGT, useGT } from '../unstableStrings';

const { mockGetRequestConditions } = vi.hoisted(() => ({
  mockGetRequestConditions: vi.fn(),
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('../../../utils/use', () => ({
  // Lets useGT() be awaited outside a React render.
  use: <T>(value: T) => value,
}));

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = [{ type: 0, value: 'Save' }];
const frenchTranslations = {
  [hashMessageTree(saveTree)]: [{ type: 0, value: 'Enregistrer' }],
};

describe('gt-next unstable getGT', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setI18nCache(
      new I18nCache({
        loadTranslations: async (locale: string) =>
          locale === 'fr' ? frenchTranslations : {},
      })
    );
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: true,
    });
  });

  it('translates with the request locale', async () => {
    const gt = await getGT();
    const rscGT = await useGT();

    expect(gt`Save`).toBe('Enregistrer');
    expect(rscGT`Save`).toBe('Enregistrer');
  });

  it('renders the source when the request disables i18n', async () => {
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });

    const gt = await getGT();

    expect(gt`Save`).toBe('Save');
  });
});

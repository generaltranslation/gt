import { hashSource } from 'generaltranslation/id';
import {
  I18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tx } from '../tx';

const { mockGetRequestConditions } = vi.hoisted(() => ({
  mockGetRequestConditions: vi.fn(),
}));

vi.mock('../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = 'Save';
const frenchTranslations = {
  [hashSource({ source: saveTree, dataFormat: 'ICU_TREE' })]: 'Enregistrer',
};

describe('gt-next unstable tx', () => {
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
    expect(await tx`Save`).toBe('Enregistrer');
  });

  it('renders the source when the request disables i18n', async () => {
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });

    expect(await tx`Save`).toBe('Save');
  });
});

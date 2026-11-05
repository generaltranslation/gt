import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient, Schema } from 'sanity';

const mocks = vi.hoisted(() => ({
  requireLatestDraft: vi.fn(),
  serializeDocument: vi.fn(),
}));

vi.mock('../../utils/requireSourceDocument', () => ({
  requireLatestDraft: mocks.requireLatestDraft,
}));
vi.mock('../../../utils/serialize', () => ({
  serializeDocument: mocks.serializeDocument,
}));

const { baseDocumentLevelConfig } = await import('../index');
const { pluginConfig } = await import('../../../adapter/core');

const exportFrPage = () =>
  baseDocumentLevelConfig.exportForTranslation(
    { documentId: 'page-fr', versionId: 'r1' },
    { client: {} as SanityClient, schema: {} as Schema }
  );

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  mocks.requireLatestDraft.mockResolvedValue({
    _id: 'page-fr',
    _type: 'page',
    language: 'fr',
  });
  mocks.serializeDocument.mockReturnValue({ content: '<p>Bonjour</p>' });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('exportForTranslation', () => {
  test('exports an original outside the source locale in its own language', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      true
    );

    expect(await exportFrPage()).toEqual({
      content: '<p>Bonjour</p>',
      documentId: 'page-fr',
      versionId: 'r1',
      sourceLocale: 'fr',
    });
    expect(mocks.serializeDocument).toHaveBeenCalledWith(
      { _id: 'page-fr', _type: 'page' },
      {},
      'fr'
    );
  });

  test('without allowNonDefaultSourceLocales, exports in the configured source locale', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );

    expect(await exportFrPage()).toEqual({
      content: '<p>Bonjour</p>',
      documentId: 'page-fr',
      versionId: 'r1',
    });
    expect(mocks.serializeDocument).toHaveBeenCalledWith(
      { _id: 'page-fr', _type: 'page' },
      {},
      'en'
    );
  });
});

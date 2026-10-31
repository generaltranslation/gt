import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const uploadSourceFiles = vi.fn();
const enqueueFiles = vi.fn();

vi.mock('../core', async () => {
  const actual = await vi.importActual<typeof import('../core')>('../core');
  return {
    ...actual,
    gt: { sourceLocale: 'en' },
    api: {
      uploadSourceFiles: (...args: unknown[]) => uploadSourceFiles(...args),
      enqueueFiles: (...args: unknown[]) => enqueueFiles(...args),
    },
    overrideConfig: vi.fn(),
  };
});
vi.mock('../getTranslationTask', () => ({
  getTranslationTask: vi.fn(async () => ({})),
}));

const { createTask } = await import('../createTask');
const { pluginConfig } = await import('../core');

const uploadedLocale = () =>
  uploadSourceFiles.mock.calls[0][0][0].source.locale as string;

beforeEach(() => {
  uploadSourceFiles.mockReset();
  uploadSourceFiles.mockResolvedValue({ uploadedFiles: [] });
  enqueueFiles.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTask', () => {
  test('uploads an original outside the source locale in its own language', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      true
    );
    await createTask(
      { documentId: 'page-fr' },
      { content: '<p>Bonjour</p>', documentId: 'page-fr', sourceLocale: 'fr' },
      ['en'],
      null
    );

    expect(uploadedLocale()).toBe('fr');
    expect(uploadSourceFiles.mock.calls[0][1]).toEqual({ sourceLocale: 'en' });
  });

  test('without allowNonDefaultSourceLocales, uploads in the configured source locale', async () => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
    await createTask(
      { documentId: 'page-fr', sourceLocale: 'fr' },
      { content: '<p>Bonjour</p>', documentId: 'page-fr', sourceLocale: 'fr' },
      ['de'],
      null
    );

    expect(uploadedLocale()).toBe('en');
    expect(uploadSourceFiles.mock.calls[0][1]).toEqual({ sourceLocale: 'en' });
    expect(enqueueFiles).toHaveBeenCalledWith([], {
      sourceLocale: 'en',
      targetLocales: ['de'],
    });
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const uploadSourceFiles = vi.fn();

vi.mock('../../adapter/core', async () => {
  const actual =
    await vi.importActual<typeof import('../../adapter/core')>(
      '../../adapter/core'
    );
  return {
    ...actual,
    gt: { sourceLocale: 'en' },
    api: {
      uploadSourceFiles: (...args: unknown[]) => uploadSourceFiles(...args),
    },
    overrideConfig: vi.fn(),
  };
});

const { uploadFiles } = await import('../uploadFiles');
const { pluginConfig } = await import('../../adapter/core');

const serializedDocument = (content: string) => ({
  name: 'doc',
  content,
});

beforeEach(() => {
  uploadSourceFiles.mockReset();
  uploadSourceFiles.mockResolvedValue({ uploadedFiles: [] });
  // Feature tests run with the option on; flag-off tests turn it off.
  vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
    true
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadFiles', () => {
  test('sends each file in its own language with the default request-level source locale', async () => {
    await uploadFiles(
      [
        {
          info: { documentId: 'page', versionId: 'r1', sourceLocale: 'en' },
          serializedDocument: serializedDocument('<p>Hello</p>'),
        },
        {
          info: { documentId: 'page-fr', versionId: 'r2', sourceLocale: 'fr' },
          serializedDocument: serializedDocument('<p>Bonjour</p>'),
        },
      ],
      null
    );

    expect(uploadSourceFiles).toHaveBeenCalledTimes(1);
    const [files, options] = uploadSourceFiles.mock.calls[0];
    expect(options).toEqual({ sourceLocale: 'en' });
    expect(
      files.map(
        (file: { source: { fileId: string; locale: string } }) =>
          `${file.source.fileId}:${file.source.locale}`
      )
    ).toEqual(['page:en', 'page-fr:fr']);
  });

  test('uses the configured source locale for files without one', async () => {
    await uploadFiles(
      [
        {
          info: { documentId: 'page', versionId: 'r1' },
          serializedDocument: serializedDocument('<p>Hello</p>'),
        },
      ],
      null
    );

    expect(uploadSourceFiles).toHaveBeenCalledWith(
      [
        {
          source: {
            content: '<p>Hello</p>',
            fileName: 'sanity/page',
            fileId: 'page',
            fileFormat: 'HTML',
            locale: 'en',
            versionId: 'r1',
          },
        },
      ],
      { sourceLocale: 'en' }
    );
  });
});

describe('uploadFiles without allowNonDefaultSourceLocales', () => {
  beforeEach(() => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
  });

  test('sends every file in the configured source locale, as before the option', async () => {
    await uploadFiles(
      [
        {
          info: { documentId: 'page', versionId: 'r1' },
          serializedDocument: serializedDocument('<p>Hello</p>'),
        },
        {
          info: { documentId: 'page-fr', versionId: 'r2', sourceLocale: 'fr' },
          serializedDocument: serializedDocument('<p>Bonjour</p>'),
        },
      ],
      null
    );

    expect(uploadSourceFiles).toHaveBeenCalledWith(
      [
        {
          source: {
            content: '<p>Hello</p>',
            fileName: 'sanity/page',
            fileId: 'page',
            fileFormat: 'HTML',
            locale: 'en',
            versionId: 'r1',
          },
        },
        {
          source: {
            content: '<p>Bonjour</p>',
            fileName: 'sanity/page-fr',
            fileId: 'page-fr',
            fileFormat: 'HTML',
            locale: 'en',
            versionId: 'r2',
          },
        },
      ],
      { sourceLocale: 'en' }
    );
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient, SanityDocument, Schema } from 'sanity';

const downloadFileBatch = vi.fn();
const uploadTranslations = vi.fn();
const collectExistingTranslations = vi.fn();

vi.mock('../../adapter/core', async () => {
  const actual =
    await vi.importActual<typeof import('../../adapter/core')>(
      '../../adapter/core'
    );
  return {
    ...actual,
    gt: {
      sourceLocale: 'en',
      downloadFileBatch: (...args: unknown[]) => downloadFileBatch(...args),
      uploadTranslations: (...args: unknown[]) => uploadTranslations(...args),
    },
    overrideConfig: vi.fn(),
  };
});

vi.mock('../collectExistingTranslations', () => ({
  collectExistingTranslations: (...args: unknown[]) =>
    collectExistingTranslations(...args),
}));

const { captureExistingTranslations } =
  await import('../captureExistingTranslations');

const doc = (id: string, rev: string) =>
  ({ _id: id, _type: 'page', _rev: rev }) as unknown as SanityDocument;

const context = {
  client: {} as SanityClient,
  schema: {} as Schema,
};

const seedFile = (fileId: string, versionId: string) => ({
  id: 'row-1',
  fileId,
  versionId,
  branchId: 'branch-1',
  fileName: `sanity/${fileId}`,
  data: '<html><body>source</body></html>',
  metadata: {},
  fileFormat: 'HTML' as const,
});

const run = (documents: SanityDocument[], localeIds = ['es']) =>
  captureExistingTranslations({
    documents,
    localeIds,
    secrets: { organization: 'o', project: 'p' },
    context,
    branchId: 'branch-1',
  });

beforeEach(() => {
  vi.clearAllMocks();
  uploadTranslations.mockResolvedValue({ uploadedFiles: [], count: 0 });
  collectExistingTranslations.mockResolvedValue(new Map());
});

describe('captureExistingTranslations', () => {
  test('does nothing without documents or locales', async () => {
    expect(await run([])).toMatchObject({ capturedCount: 0 });
    expect(await run([doc('a', 'rev-1')], [])).toMatchObject({
      capturedCount: 0,
    });
    expect(downloadFileBatch).not.toHaveBeenCalled();
  });

  test('pins translations to the version GT already has, not the live _rev', async () => {
    // The live document has moved on to rev-new, but GT still holds rev-old.
    // Pinning to rev-new would mark the not-yet-uploaded version as already
    // translated, and the worker would abandon the job instead of translating.
    downloadFileBatch.mockResolvedValue({
      files: [seedFile('a', 'rev-old')],
      count: 1,
    });
    collectExistingTranslations.mockResolvedValue(
      new Map([['a', [{ locale: 'es', content: '<html>hola</html>' }]]])
    );

    const result = await run([doc('a', 'rev-new')]);

    expect(result).toMatchObject({ capturedCount: 1, documentCount: 1 });

    const [files, options] = uploadTranslations.mock.calls[0];
    expect(options).toEqual({ sourceLocale: 'en' });
    expect(files[0].source).toMatchObject({
      fileId: 'a',
      versionId: 'rev-old',
      branchId: 'branch-1',
    });
    expect(files[0].translations[0]).toMatchObject({
      locale: 'es',
      fileId: 'a',
      versionId: 'rev-old',
      branchId: 'branch-1',
    });
  });

  test('asks GT for the latest version rather than naming one', async () => {
    downloadFileBatch.mockResolvedValue({ files: [], count: 0 });
    await run([doc('a', 'rev-new')]);

    expect(downloadFileBatch).toHaveBeenCalledWith([
      { fileId: 'a', branchId: 'branch-1' },
    ]);
  });

  test('skips documents GT has no source file for', async () => {
    downloadFileBatch.mockResolvedValue({ files: [], count: 0 });

    await run([doc('a', 'rev-1')]);

    expect(uploadTranslations).not.toHaveBeenCalled();
    // Documents with no source file must not reach the collector either.
    expect(collectExistingTranslations).toHaveBeenCalledWith(
      [],
      ['es'],
      context
    );
  });

  test('uploads nothing when Sanity has no existing translations', async () => {
    downloadFileBatch.mockResolvedValue({
      files: [seedFile('a', 'rev-old')],
      count: 1,
    });
    collectExistingTranslations.mockResolvedValue(new Map());

    const result = await run([doc('a', 'rev-1')]);

    expect(result.capturedCount).toBe(0);
    expect(uploadTranslations).not.toHaveBeenCalled();
  });

  test('carries every collected locale for a document', async () => {
    downloadFileBatch.mockResolvedValue({
      files: [seedFile('a', 'rev-old')],
      count: 1,
    });
    collectExistingTranslations.mockResolvedValue(
      new Map([
        [
          'a',
          [
            { locale: 'es', content: '<html>hola</html>' },
            { locale: 'fr', content: '<html>bonjour</html>' },
          ],
        ],
      ])
    );

    const result = await run([doc('a', 'rev-1')], ['es', 'fr']);

    expect(result).toMatchObject({ capturedCount: 2, documentCount: 1 });
    const [files] = uploadTranslations.mock.calls[0];
    expect(
      files[0].translations.map((t: { locale: string }) => t.locale)
    ).toEqual(['es', 'fr']);
  });
});

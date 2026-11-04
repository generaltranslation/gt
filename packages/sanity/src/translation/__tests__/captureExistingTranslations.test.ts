import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SanityClient, SanityDocument, Schema } from 'sanity';

const queryFilesContent = vi.fn();
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
      defaultLocale: 'en',
    },
    projectFor: () => ({
      queryFilesContent: (...args: unknown[]) => queryFilesContent(...args),
      uploadTranslations: (...args: unknown[]) => uploadTranslations(...args),
    }),
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
  status: 'ready' as const,
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
  // Echo every translation as saved unless a test says otherwise.
  uploadTranslations.mockImplementation(
    async (
      files: Array<{ translations: Array<{ fileId: string; locale: string }> }>
    ) => {
      const results = files.flatMap((file) =>
        file.translations.map(({ fileId, locale }) => ({
          fileId,
          locale,
          status: 'succeeded',
        }))
      );
      return {
        summary: {
          total: results.length,
          succeeded: results.length,
          failed: 0,
        },
        results,
      };
    }
  );
  collectExistingTranslations.mockResolvedValue(new Map());
});

describe('captureExistingTranslations', () => {
  test('does nothing without documents or locales', async () => {
    expect(await run([])).toMatchObject({ capturedCount: 0 });
    expect(await run([doc('a', 'rev-1')], [])).toMatchObject({
      capturedCount: 0,
    });
    expect(queryFilesContent).not.toHaveBeenCalled();
  });

  test('pins translations to the version GT already has, not the live _rev', async () => {
    // The live document has moved on to rev-new, but GT still holds rev-old.
    // Pinning to rev-new would mark the not-yet-uploaded version as already
    // translated, and the worker would abandon the job instead of translating.
    queryFilesContent.mockResolvedValue({
      results: [seedFile('a', 'rev-old')],
    });
    collectExistingTranslations.mockResolvedValue(
      new Map([['a', [{ locale: 'es', content: '<html>hola</html>' }]]])
    );

    const result = await run([doc('a', 'rev-new')]);

    expect(result).toMatchObject({ capturedCount: 1, documentCount: 1 });

    const [files, ...rest] = uploadTranslations.mock.calls[0];
    expect(rest).toEqual([]);
    expect(files[0].source).toMatchObject({
      locale: 'en',
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
    queryFilesContent.mockResolvedValue({
      results: [{ status: 'not_found', fileId: 'a' }],
    });
    await run([doc('a', 'rev-new')]);

    expect(queryFilesContent).toHaveBeenCalledWith([
      { fileId: 'a', branchId: 'branch-1' },
    ]);
  });

  test('skips documents GT has no source file for', async () => {
    queryFilesContent.mockResolvedValue({
      results: [{ status: 'not_found', fileId: 'a' }],
    });

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
    queryFilesContent.mockResolvedValue({
      results: [seedFile('a', 'rev-old')],
    });
    collectExistingTranslations.mockResolvedValue(new Map());

    const result = await run([doc('a', 'rev-1')]);

    expect(result.capturedCount).toBe(0);
    expect(uploadTranslations).not.toHaveBeenCalled();
  });

  test('carries every collected locale for a document', async () => {
    queryFilesContent.mockResolvedValue({
      results: [seedFile('a', 'rev-old')],
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

  test('counts only the translations General Translation saved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    queryFilesContent.mockResolvedValue({
      results: [seedFile('a', 'rev-old'), seedFile('b', 'rev-old')],
    });
    collectExistingTranslations.mockResolvedValue(
      new Map([
        ['a', [{ locale: 'es', content: '<html>hola</html>' }]],
        ['b', [{ locale: 'es', content: '<html>hola</html>' }]],
      ])
    );
    uploadTranslations.mockResolvedValue({
      summary: { total: 2, succeeded: 1, failed: 1 },
      results: [
        { fileId: 'a', locale: 'es', status: 'succeeded' },
        { fileId: 'b', locale: 'es', status: 'failed', error: 'not saved' },
      ],
    });

    const result = await run([doc('a', 'rev-1'), doc('b', 'rev-1')]);

    expect(result).toEqual({
      capturedCount: 1,
      documentCount: 1,
      failedCount: 1,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('b (es): not saved')
    );
    warn.mockRestore();
  });
});

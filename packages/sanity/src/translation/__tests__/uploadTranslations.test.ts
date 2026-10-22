import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';
import { api } from '../../adapter/core';
import type { GTFile } from '../../types';
import { uploadTranslations } from '../uploadTranslations';

vi.mock('../../adapter/core', () => ({
  api: { uploadTranslations: vi.fn() },
  gt: { sourceLocale: 'en' },
  overrideConfig: vi.fn(),
}));

const document = (documentId: string) =>
  ({
    info: { documentId, versionId: 'rev-1' } as GTFile,
    serializedDocument: { content: '<p>Hi</p>' },
    translations: [{ locale: 'es', content: '<p>Hola</p>' }],
  }) as Parameters<typeof uploadTranslations>[0][number];

describe('uploadTranslations ID limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('fails the translations of a document whose ID is too long and uploads the others', async () => {
    // Like GT's request validation: one over-long file ID fails the request.
    vi.mocked(api.uploadTranslations).mockImplementation(async (files) => {
      if (files.some(({ source }) => source.fileId!.length > 64))
        throw new ApiError('Bad request', 400);
      const results = files.flatMap(({ source, translations }) =>
        translations.map((translation) => ({
          branchId: 'branch-1',
          fileId: source.fileId!,
          versionId: source.versionId!,
          fileName: translation.fileName,
          fileFormat: translation.fileFormat,
          locale: translation.locale,
          status: 'succeeded' as const,
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
    });
    const longId = 'd'.repeat(65);

    const result = await uploadTranslations(
      [document('doc-1'), document(longId)],
      null
    );

    expect(result?.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(
      result?.results.map(({ fileId, locale, status }) => ({
        fileId,
        locale,
        status,
      }))
    ).toEqual([
      { fileId: 'doc-1', locale: 'es', status: 'succeeded' },
      { fileId: longId, locale: 'es', status: 'failed' },
    ]);
  });
});

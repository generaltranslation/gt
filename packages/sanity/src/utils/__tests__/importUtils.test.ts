import { describe, expect, test } from 'vitest';
import { getReadyFilesForImport } from '../importUtils';

describe('getReadyFilesForImport', () => {
  test('dedupes ready files by branch, source document, and locale', async () => {
    const statuses = new Map([
      [
        'branch:article-1:rev-1:es',
        {
          progress: 100,
          isReady: true,
          fileData: {
            branchId: 'branch',
            fileId: 'article-1',
            versionId: 'rev-1',
            locale: 'es',
          },
        },
      ],
      [
        'branch:article-1:rev-2:es',
        {
          progress: 100,
          isReady: true,
          fileData: {
            branchId: 'branch',
            fileId: 'drafts.article-1',
            versionId: 'rev-2',
            locale: 'es',
          },
        },
      ],
      [
        'branch:article-1:rev-2:fr',
        {
          progress: 100,
          isReady: true,
          fileData: {
            branchId: 'branch',
            fileId: 'article-1',
            versionId: 'rev-2',
            locale: 'fr',
          },
        },
      ],
    ] as any);

    const readyFiles = await getReadyFilesForImport(statuses);

    expect(readyFiles).toEqual([
      {
        branchId: 'branch',
        fileId: 'article-1',
        versionId: 'rev-2',
        locale: 'es',
      },
      {
        branchId: 'branch',
        fileId: 'article-1',
        versionId: 'rev-2',
        locale: 'fr',
      },
    ]);
  });
});

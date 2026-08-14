import { describe, expect, test } from 'vitest';
import type { TranslationStatus } from '../../adapter/types';
import { getReadyFilesForImport } from '../importUtils';

describe('getReadyFilesForImport', () => {
  test('dedupes ready files by branch, source document, and locale', async () => {
    const statuses = new Map<string, TranslationStatus>([
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
    ]);

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

  test('reports the status keys it selected, so rows can show import progress', async () => {
    // Reports the map keys, which is what the locale rows are indexed by,
    // rather than rederiving them from each file. The fixture gives the file a
    // different version from its key to pin that down: the two agree in
    // practice, and this keeps a row's progress from depending on it.
    const statuses = new Map<string, TranslationStatus>([
      [
        'branch:article-1:rev-pinned:es',
        {
          progress: 100,
          isReady: true,
          fileData: {
            branchId: 'branch',
            fileId: 'article-1',
            versionId: 'rev-from-file',
            locale: 'es',
          },
        },
      ],
      [
        'branch:article-2:rev-pinned:fr',
        {
          progress: 100,
          isReady: true,
          fileData: {
            branchId: 'branch',
            fileId: 'article-2',
            versionId: 'rev-from-file',
            locale: 'fr',
          },
        },
      ],
      ['branch:article-3:rev-pinned:de', { progress: 0, isReady: false }],
    ]);

    const selected: string[][] = [];
    await getReadyFilesForImport(statuses, {
      onSelectedKeys: (keys) => selected.push(keys),
    });

    expect(selected).toEqual([
      ['branch:article-1:rev-pinned:es', 'branch:article-2:rev-pinned:fr'],
    ]);
  });

  test('only reports keys that survive the ready filter', async () => {
    const statuses = new Map<string, TranslationStatus>([
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
        'branch:article-2:rev-1:fr',
        {
          progress: 100,
          isReady: true,
          fileData: {
            branchId: 'branch',
            fileId: 'article-2',
            versionId: 'rev-1',
            locale: 'fr',
          },
        },
      ],
    ]);

    const selected: string[] = [];
    await getReadyFilesForImport(statuses, {
      filterReadyFiles: (key) => key.endsWith(':fr'),
      onSelectedKeys: (keys) => selected.push(...keys),
    });

    expect(selected).toEqual(['branch:article-2:rev-1:fr']);
  });
});

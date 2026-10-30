import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GT, FileReference } from 'generaltranslation';
import { filterFilesForEnqueue } from '../filterFilesForEnqueue.js';

describe('filterFilesForEnqueue', () => {
  const file: FileReference = {
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    fileName: 'messages/en.json',
    fileFormat: 'JSON',
  };

  const completedTranslation = (locale: string) => ({
    branchId: file.branchId,
    fileId: file.fileId,
    versionId: file.versionId,
    locale,
    status: 'found',
    completedAt: '2026-01-01T00:00:00.000Z',
  });

  const gt = {
    queryFiles: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips enqueue when every target locale is already completed', async () => {
    gt.queryFiles.mockResolvedValue({
      results: [completedTranslation('es'), completedTranslation('fr')],
    });

    const result = await filterFilesForEnqueue({
      gt: gt as unknown as GT,
      files: [file],
      locales: ['es', 'fr'],
    });

    expect(result.filesToEnqueue).toEqual([]);
    expect(result.skippedFiles).toEqual([file]);
    expect(gt.queryFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        locale: 'es',
      }),
      expect.objectContaining({
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        locale: 'fr',
      }),
    ]);
  });

  it('enqueues when any target locale is incomplete', async () => {
    gt.queryFiles.mockResolvedValue({
      results: [
        completedTranslation('es'),
        {
          ...completedTranslation('fr'),
          status: 'pending',
          completedAt: null,
        },
      ],
    });

    const result = await filterFilesForEnqueue({
      gt: gt as unknown as GT,
      files: [file],
      locales: ['es', 'fr'],
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });

  it('does not query status when force is enabled', async () => {
    const result = await filterFilesForEnqueue({
      gt: gt as unknown as GT,
      files: [file],
      locales: ['es'],
      force: true,
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
    expect(gt.queryFiles).not.toHaveBeenCalled();
  });

  it('falls back to enqueueing when status query fails', async () => {
    gt.queryFiles.mockRejectedValue(new Error('query failed'));

    const result = await filterFilesForEnqueue({
      gt: gt as unknown as GT,
      files: [file],
      locales: ['es'],
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });
});

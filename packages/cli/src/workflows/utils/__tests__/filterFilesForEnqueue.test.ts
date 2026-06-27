import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GT } from 'generaltranslation';
import type { FileReference } from 'generaltranslation/types';
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
    completedAt: '2026-01-01T00:00:00.000Z',
  });

  const gt = {
    queryFileData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips enqueue when every target locale is already completed', async () => {
    gt.queryFileData.mockResolvedValue({
      translatedFiles: [completedTranslation('es'), completedTranslation('fr')],
    });

    const result = await filterFilesForEnqueue({
      gt: gt as unknown as GT,
      files: [file],
      locales: ['es', 'fr'],
    });

    expect(result.filesToEnqueue).toEqual([]);
    expect(result.skippedFiles).toEqual([file]);
    expect(gt.queryFileData).toHaveBeenCalledWith({
      translatedFiles: [
        {
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'es',
        },
        {
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'fr',
        },
      ],
    });
  });

  it('enqueues when any target locale is incomplete', async () => {
    gt.queryFileData.mockResolvedValue({
      translatedFiles: [
        completedTranslation('es'),
        {
          ...completedTranslation('fr'),
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
    expect(gt.queryFileData).not.toHaveBeenCalled();
  });

  it('falls back to enqueueing when status query fails', async () => {
    gt.queryFileData.mockRejectedValue(new Error('query failed'));

    const result = await filterFilesForEnqueue({
      gt: gt as unknown as GT,
      files: [file],
      locales: ['es'],
    });

    expect(result.filesToEnqueue).toEqual([file]);
    expect(result.skippedFiles).toEqual([]);
  });
});

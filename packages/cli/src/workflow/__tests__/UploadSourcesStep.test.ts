import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadSourcesStep } from '../UploadSourcesStep.js';
import type { FileToUpload } from 'generaltranslation/types';

// Mock the GT class
const mockGt = {
  queryFileData: vi.fn(),
  getOrphanedFiles: vi.fn(),
  processFileMoves: vi.fn(),
  uploadSourceFiles: vi.fn(),
};

// Mock the logger
vi.mock('../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    createSpinner: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    }),
  },
}));

describe('UploadSourcesStep', () => {
  const mockSettings = {
    defaultLocale: 'en',
    modelProvider: undefined,
  };

  const mockBranchData = {
    currentBranch: { id: 'branch-123', name: 'main' },
    incomingBranch: undefined,
    checkedOutBranch: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('move detection', () => {
    it('should detect a file move when versionId matches but fileId differs', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'test content',
          fileName: 'locales/en.json', // New path
          fileFormat: 'JSON',
          locale: 'en',
          fileId: 'new-file-id-hash', // New hash (from new path)
          versionId: 'same-content-hash', // Same content
        },
      ];

      // Server has the file at old path
      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-file-id-hash', // Old hash (from old path)
            versionId: 'same-content-hash', // Same content
            fileName: 'src/i18n/en.json', // Old path
          },
        ],
      });

      mockGt.processFileMoves.mockResolvedValue({
        results: [
          {
            oldFileId: 'old-file-id-hash',
            newFileId: 'new-file-id-hash',
            success: true,
            newSourceFileId: 'new-source-id',
            clonedTranslationsCount: 2,
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
      });

      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      await step.run({ files: localFiles, branchData: mockBranchData as any });

      // Verify move was detected and processed
      expect(mockGt.processFileMoves).toHaveBeenCalledWith(
        [
          {
            oldFileId: 'old-file-id-hash',
            newFileId: 'new-file-id-hash',
            newFileName: 'locales/en.json',
          },
        ],
        { branchId: 'branch-123' }
      );
    });

    it('should not detect move when versionId differs', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'new content',
          fileName: 'locales/en.json',
          fileFormat: 'JSON',
          locale: 'en',
          fileId: 'new-file-id-hash',
          versionId: 'new-content-hash', // Different content
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-file-id-hash',
            versionId: 'old-content-hash', // Different content
            fileName: 'src/i18n/en.json',
          },
        ],
      });

      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [{ fileId: 'new-file-id-hash' }],
        count: 1,
      });

      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      await step.run({ files: localFiles, branchData: mockBranchData as any });

      // No move should be processed - it's a new file
      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
    });

    it('should not detect move when fileId is the same', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'test content',
          fileName: 'locales/en.json',
          fileFormat: 'JSON',
          locale: 'en',
          fileId: 'same-file-id-hash',
          versionId: 'same-content-hash',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [
          {
            branchId: 'branch-123',
            fileId: 'same-file-id-hash',
            versionId: 'same-content-hash',
          },
        ],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [],
      });

      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      await step.run({ files: localFiles, branchData: mockBranchData as any });

      // No move, file already exists at same path
      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
    });

    it('should detect multiple moves in a batch', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'content 1',
          fileName: 'locales/en.json',
          fileFormat: 'JSON',
          locale: 'en',
          fileId: 'new-id-1',
          versionId: 'version-1',
        },
        {
          content: 'content 2',
          fileName: 'locales/es.json',
          fileFormat: 'JSON',
          locale: 'es',
          fileId: 'new-id-2',
          versionId: 'version-2',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-id-1',
            versionId: 'version-1',
            fileName: 'old/en.json',
          },
          {
            fileId: 'old-id-2',
            versionId: 'version-2',
            fileName: 'old/es.json',
          },
        ],
      });

      mockGt.processFileMoves.mockResolvedValue({
        results: [
          { oldFileId: 'old-id-1', newFileId: 'new-id-1', success: true },
          { oldFileId: 'old-id-2', newFileId: 'new-id-2', success: true },
        ],
        summary: { total: 2, succeeded: 2, failed: 0 },
      });

      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      await step.run({ files: localFiles, branchData: mockBranchData as any });

      expect(mockGt.processFileMoves).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            oldFileId: 'old-id-1',
            newFileId: 'new-id-1',
          }),
          expect.objectContaining({
            oldFileId: 'old-id-2',
            newFileId: 'new-id-2',
          }),
        ]),
        { branchId: 'branch-123' }
      );
    });

    it('should skip upload for successfully moved files', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'content',
          fileName: 'locales/en.json',
          fileFormat: 'JSON',
          locale: 'en',
          fileId: 'new-file-id',
          versionId: 'content-hash',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-file-id',
            versionId: 'content-hash',
            fileName: 'old.json',
          },
        ],
      });

      mockGt.processFileMoves.mockResolvedValue({
        results: [
          { oldFileId: 'old-file-id', newFileId: 'new-file-id', success: true },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
      });

      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      const result = await step.run({
        files: localFiles,
        branchData: mockBranchData as any,
      });

      // Upload should be called with empty array (file was moved, not uploaded)
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [], // No files to upload
        expect.any(Object)
      );

      // Result should include the moved file
      expect(result).toContainEqual(
        expect.objectContaining({ fileId: 'new-file-id' })
      );
    });

    it('should handle empty files array', async () => {
      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      const result = await step.run({
        files: [],
        branchData: mockBranchData as any,
      });

      expect(result).toEqual([]);
      expect(mockGt.queryFileData).not.toHaveBeenCalled();
      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
    });

    it('should handle no orphaned files', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'new content',
          fileName: 'brand-new.json',
          fileFormat: 'JSON',
          locale: 'en',
          fileId: 'brand-new-id',
          versionId: 'brand-new-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [], // No orphaned files
      });

      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [{ fileId: 'brand-new-id' }],
        count: 1,
      });

      const step = new UploadSourcesStep(mockGt as any, mockSettings as any);
      await step.run({ files: localFiles, branchData: mockBranchData as any });

      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'brand-new-id' }),
          }),
        ]),
        expect.any(Object)
      );
    });
  });
});

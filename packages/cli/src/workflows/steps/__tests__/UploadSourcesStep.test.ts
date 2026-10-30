import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadSourcesStep } from '../UploadSourcesStep.js';
import type { FileToUpload } from 'generaltranslation';
import type { BranchData } from '../../../types/branch.js';
import {
  clearOrphanedFileNames,
  getOrphanedFileNames,
} from '../../../state/orphanedFileNames.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';
import { logger } from '../../../console/logger.js';
import { ApiError, ErrorCode } from '@generaltranslation/api';

const mockGt = {
  queryFiles: vi.fn(),
  listBranchFiles: vi.fn(),
  moveFiles: vi.fn(),
  uploadSourceFiles: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
};

// queryFiles answers one result per selector, in selector order
function answerNotFound() {
  mockGt.queryFiles.mockImplementation(
    async (files: Array<{ fileId: string }>) => ({
      results: files.map((file) => ({ ...file, status: 'not_found' })),
    })
  );
}

function uploadResults(
  results: Array<Record<string, unknown> & { status: string }>
) {
  const failed = results.filter((r) => r.status === 'failed').length;
  return {
    summary: {
      total: results.length,
      succeeded: results.length - failed,
      failed,
    },
    results,
  };
}

const mockSpinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
}));

// Mock the logger
vi.mock('../../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    createSpinner: () => mockSpinner,
  },
}));

describe('UploadSourcesStep', () => {
  const mockSettings = {
    defaultLocale: 'en',
    modelProvider: undefined,
  };

  const mockBranchData: BranchData = {
    currentBranch: { id: 'branch-123', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
    answerNotFound();
    mockGt.get.mockResolvedValue({ defaultLocale: 'en' });
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
      mockGt.listBranchFiles.mockResolvedValue({
        items: [
          {
            fileId: 'old-file-id-hash', // Old hash (from old path)
            versionId: 'same-content-hash', // Same content
            fileName: 'src/i18n/en.json', // Old path
          },
        ],
        nextCursor: null,
      });

      mockGt.moveFiles.mockResolvedValue({
        results: [
          {
            oldFileId: 'old-file-id-hash',
            newFileId: 'new-file-id-hash',
            status: 'succeeded',
            newSourceFileId: 'new-source-id',
            clonedTranslationsCount: 2,
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
      });

      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      // Verify move was detected and processed
      expect(mockGt.moveFiles).toHaveBeenCalledWith(
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

      mockGt.listBranchFiles.mockResolvedValue({
        items: [
          {
            fileId: 'old-file-id-hash',
            versionId: 'old-content-hash', // Different content
            fileName: 'src/i18n/en.json',
          },
        ],
        nextCursor: null,
      });

      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ fileId: 'new-file-id-hash', status: 'succeeded' }])
      );

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      // No move should be processed - it's a new file
      expect(mockGt.moveFiles).not.toHaveBeenCalled();
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

      mockGt.queryFiles.mockResolvedValue({
        results: [
          {
            status: 'found',
            branchId: 'branch-123',
            fileId: 'same-file-id-hash',
            versionId: 'same-content-hash',
          },
        ],
      });
      mockGt.listBranchFiles.mockResolvedValue({
        items: [],
        nextCursor: null,
      });

      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      // No move, file already exists at same path
      expect(mockGt.moveFiles).not.toHaveBeenCalled();
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

      mockGt.listBranchFiles.mockResolvedValue({
        items: [
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
        nextCursor: null,
      });

      mockGt.moveFiles.mockResolvedValue({
        results: [
          { oldFileId: 'old-id-1', newFileId: 'new-id-1', status: 'succeeded' },
          { oldFileId: 'old-id-2', newFileId: 'new-id-2', status: 'succeeded' },
        ],
        summary: { total: 2, succeeded: 2, failed: 0 },
      });

      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.moveFiles).toHaveBeenCalledWith(
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

      mockGt.listBranchFiles.mockResolvedValue({
        items: [
          {
            fileId: 'old-file-id',
            versionId: 'content-hash',
            fileName: 'old.json',
          },
        ],
        nextCursor: null,
      });

      mockGt.moveFiles.mockResolvedValue({
        results: [
          {
            oldFileId: 'old-file-id',
            newFileId: 'new-file-id',
            status: 'succeeded',
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
      });

      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      const result = await step.run({
        files: localFiles,
        branchData: mockBranchData,
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
      const step = new UploadSourcesStep(mockGt, mockSettings);
      const result = await step.run({
        files: [],
        branchData: mockBranchData,
      });

      expect(result).toEqual([]);
      expect(mockGt.queryFiles).not.toHaveBeenCalled();
      expect(mockGt.moveFiles).not.toHaveBeenCalled();
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

      mockGt.listBranchFiles.mockResolvedValue({
        items: [],
        nextCursor: null,
      });

      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ fileId: 'brand-new-id', status: 'succeeded' }])
      );

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.moveFiles).not.toHaveBeenCalled();
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
  describe('canonical operations and partial failures', () => {
    const file = (name: string, versionId = `v:${name}`): FileToUpload => ({
      content: name,
      fileName: name,
      fileFormat: 'JSON',
      locale: 'en',
      fileId: `id:${name}`,
      versionId,
    });

    beforeEach(() => clearOrphanedFileNames());

    it('pages through the branch files and treats non-local ones as orphans', async () => {
      mockGt.listBranchFiles
        .mockResolvedValueOnce({
          items: [
            { fileId: 'id:a.json', versionId: 'v:a.json', fileName: 'a.json' },
            { fileId: 'id:old.json', versionId: 'v:x', fileName: 'old.json' },
          ],
          nextCursor: 'page-2',
        })
        .mockResolvedValueOnce({
          items: [
            { fileId: 'id:gone.json', versionId: 'v:y', fileName: 'gone.json' },
          ],
          nextCursor: null,
        });
      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: [file('a.json')], branchData: mockBranchData });

      expect(mockGt.listBranchFiles).toHaveBeenNthCalledWith(1, 'branch-123', {
        cursor: undefined,
      });
      expect(mockGt.listBranchFiles).toHaveBeenNthCalledWith(2, 'branch-123', {
        cursor: 'page-2',
      });
      expect(getOrphanedFileNames()).toEqual(['old.json', 'gone.json']);
    });

    it('skips files whose version the platform already has', async () => {
      mockGt.listBranchFiles.mockResolvedValue({ items: [], nextCursor: null });
      mockGt.queryFiles.mockResolvedValue({
        results: [
          { status: 'found', fileId: 'id:a.json', branchId: 'branch-123' },
          { status: 'not_found', fileId: 'id:b.json' },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({
        files: [file('a.json'), file('b.json')],
        branchData: mockBranchData,
      });

      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'id:b.json' }),
          }),
        ],
        expect.any(Object)
      );
    });

    it('records failed moves and uploads the moved file instead', async () => {
      mockGt.listBranchFiles.mockResolvedValue({
        items: [
          { fileId: 'id:old.json', versionId: 'v1', fileName: 'old.json' },
        ],
        nextCursor: null,
      });
      mockGt.moveFiles.mockResolvedValue({
        summary: { total: 1, succeeded: 0, failed: 1 },
        results: [
          {
            oldFileId: 'id:old.json',
            newFileId: 'id:new.json',
            status: 'failed',
            error: 'source missing',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({
        files: [file('new.json', 'v1')],
        branchData: mockBranchData,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to migrate moved file new.json: source missing'
      );
      expect(getWarnings()).toEqual([
        {
          category: 'failed_move',
          fileName: 'new.json',
          reason: 'source missing',
        },
      ]);
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'id:new.json' }),
          }),
        ],
        expect.any(Object)
      );
    });

    it('returns only saved files and records each failed upload', async () => {
      mockGt.listBranchFiles.mockResolvedValue({ items: [], nextCursor: null });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([
          {
            branchId: 'branch-123',
            fileId: 'id:a.json',
            versionId: 'v:a.json',
            fileName: 'a.json',
            fileFormat: 'JSON',
            status: 'succeeded',
          },
          {
            branchId: 'branch-123',
            fileId: 'id:b.json',
            versionId: 'v:b.json',
            fileName: 'b.json',
            fileFormat: 'JSON',
            status: 'failed',
            error: 'storage unavailable',
          },
        ])
      );

      const step = new UploadSourcesStep(mockGt, mockSettings);
      const result = await step.run({
        files: [file('a.json'), file('b.json')],
        branchData: mockBranchData,
      });

      expect(result.map((f) => f.fileId)).toEqual(['id:a.json']);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to upload b.json: storage unavailable'
      );
      expect(getWarnings()).toEqual([
        {
          category: 'failed_upload',
          fileName: 'b.json',
          reason: 'storage unavailable',
        },
      ]);
    });
  });

  describe('project default locale', () => {
    const file: FileToUpload = {
      content: 'a',
      fileName: 'a.json',
      fileFormat: 'JSON',
      locale: 'en',
      fileId: 'id:a.json',
      versionId: 'v:a.json',
    };
    const saved = {
      branchId: 'branch-123',
      fileId: 'id:a.json',
      versionId: 'v:a.json',
      fileName: 'a.json',
      fileFormat: 'JSON',
    };

    beforeEach(() => {
      mockGt.listBranchFiles.mockResolvedValue({ items: [], nextCursor: null });
    });

    it('sets the project default locale when it differs from the source locale', async () => {
      mockGt.get.mockResolvedValue({ defaultLocale: 'fr' });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ ...saved, status: 'succeeded' }])
      );

      await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [file],
        branchData: mockBranchData,
      });

      expect(mockGt.update).toHaveBeenCalledWith({
        defaultLocale: 'en',
      });
    });

    it('leaves the project alone when its default locale already matches', async () => {
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ ...saved, status: 'succeeded' }])
      );

      await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [file],
        branchData: mockBranchData,
      });

      expect(mockGt.get).toHaveBeenCalledTimes(1);
      expect(mockGt.update).not.toHaveBeenCalled();
    });

    it('leaves the project alone when no source was saved', async () => {
      mockGt.get.mockResolvedValue({ defaultLocale: 'fr' });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ ...saved, status: 'failed', error: 'down' }])
      );

      await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [file],
        branchData: mockBranchData,
      });

      expect(mockGt.update).not.toHaveBeenCalled();
    });

    it('warns and keeps the uploaded files when the key cannot update the project', async () => {
      mockGt.get.mockResolvedValue({ defaultLocale: 'fr' });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ ...saved, status: 'succeeded' }])
      );
      mockGt.update.mockRejectedValueOnce(
        new ApiError('Forbidden', 403, ErrorCode.PERMISSION_MISSING)
      );

      const result = await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [file],
        branchData: mockBranchData,
      });

      expect(result.map(({ fileId }) => fileId)).toEqual(['id:a.json']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("project's default locale was not updated")
      );
      expect(getWarnings()).toEqual([
        {
          category: 'failed_project_update',
          fileName: 'Default locale',
          reason: 'The API key lacks project:write, so it stays fr',
        },
      ]);
    });

    it('propagates other project update errors', async () => {
      mockGt.get.mockResolvedValue({ defaultLocale: 'fr' });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ ...saved, status: 'succeeded' }])
      );
      mockGt.update.mockRejectedValueOnce(new ApiError('Server error', 500));

      await expect(
        new UploadSourcesStep(mockGt, mockSettings).run({
          files: [file],
          branchData: mockBranchData,
        })
      ).rejects.toThrow('Server error');
      expect(getWarnings()).toEqual([]);
    });

    it('propagates a 403 that is not a missing permission', async () => {
      mockGt.get.mockResolvedValue({ defaultLocale: 'fr' });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([{ ...saved, status: 'succeeded' }])
      );
      mockGt.update.mockRejectedValueOnce(
        new ApiError('Sign in again', 403, ErrorCode.SCOPE_MISSING)
      );

      await expect(
        new UploadSourcesStep(mockGt, mockSettings).run({
          files: [file],
          branchData: mockBranchData,
        })
      ).rejects.toThrow('Sign in again');
      expect(getWarnings()).toEqual([]);
    });
  });

  describe('completion message', () => {
    it('counts only succeeded moves and reports failed ones', async () => {
      const file = (fileName: string): FileToUpload => ({
        content: fileName,
        fileName,
        fileFormat: 'JSON',
        locale: 'en',
        fileId: `id:${fileName}`,
        versionId: `v:${fileName}`,
      });
      mockGt.listBranchFiles.mockResolvedValue({
        items: ['a.json', 'b.json'].map((name) => ({
          fileId: `id:old-${name}`,
          versionId: `v:${name}`,
          fileName: `old-${name}`,
        })),
        nextCursor: null,
      });
      mockGt.moveFiles.mockResolvedValue({
        summary: { total: 2, succeeded: 1, failed: 1 },
        results: [
          {
            oldFileId: 'id:old-a.json',
            newFileId: 'id:a.json',
            status: 'succeeded',
          },
          {
            oldFileId: 'id:old-b.json',
            newFileId: 'id:b.json',
            status: 'failed',
            error: 'source missing',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue(
        uploadResults([
          {
            branchId: 'branch-123',
            fileId: 'id:b.json',
            versionId: 'v:b.json',
            fileName: 'b.json',
            fileFormat: 'JSON',
            status: 'succeeded',
          },
        ])
      );

      await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [file('a.json'), file('b.json')],
        branchData: mockBranchData,
      });

      const [completion] = mockSpinner.stop.mock.calls.at(-1)!;
      expect(completion).toContain('(1 moved, 1 move failed)');
      expect(completion).not.toContain('Files uploaded successfully');
    });
  });

  describe('orphaned file names', () => {
    beforeEach(() => clearOrphanedFileNames());

    it('records every orphan, including the old names of moved files', async () => {
      const file = (fileName: string, versionId: string): FileToUpload => ({
        content: versionId,
        fileName,
        fileFormat: 'MDX',
        locale: 'en',
        fileId: `id:${fileName}`,
        versionId,
      });
      mockGt.listBranchFiles.mockResolvedValue({
        items: [
          {
            fileId: 'id:docs/old.mdx',
            versionId: 'v1',
            fileName: 'docs/old.mdx',
          },
          {
            fileId: 'id:docs/removed.mdx',
            versionId: 'v2',
            fileName: 'docs/removed.mdx',
          },
        ],
        nextCursor: null,
      });
      mockGt.moveFiles.mockResolvedValue({
        results: [
          {
            oldFileId: 'id:docs/old.mdx',
            newFileId: 'id:docs/new.mdx',
            status: 'succeeded',
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
      });
      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));

      const step = new UploadSourcesStep(
        mockGt as never,
        mockSettings as never
      );
      await step.run({
        files: [file('docs/new.mdx', 'v1')],
        branchData: mockBranchData,
      });

      expect(getOrphanedFileNames()).toEqual([
        'docs/old.mdx',
        'docs/removed.mdx',
      ]);
    });

    it('clears names from an earlier run when there are no files', async () => {
      const step = new UploadSourcesStep(
        mockGt as never,
        mockSettings as never
      );
      mockGt.listBranchFiles.mockResolvedValue({
        items: [{ fileId: 'id:a', versionId: 'v', fileName: 'docs/a.mdx' }],
        nextCursor: null,
      });
      mockGt.uploadSourceFiles.mockResolvedValue(uploadResults([]));
      await step.run({
        files: [
          {
            content: 'b',
            fileName: 'docs/b.mdx',
            fileFormat: 'MDX',
            locale: 'en',
            fileId: 'id:b',
            versionId: 'b',
          },
        ],
        branchData: mockBranchData,
      });

      await step.run({ files: [], branchData: mockBranchData });

      expect(getOrphanedFileNames()).toBeNull();
    });
  });
});

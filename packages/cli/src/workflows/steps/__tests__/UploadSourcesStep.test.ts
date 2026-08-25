import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UploadSourcesStep } from '../UploadSourcesStep.js';
import type { FileToUpload } from 'generaltranslation/types';
import type { BranchData } from '../../../types/branch.js';
import {
  migrateLockfileFileIds,
  readLockfile,
  writeLockfile,
} from '../../../fs/config/downloadedVersions.js';

vi.mock('../../../fs/config/downloadedVersions.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../fs/config/downloadedVersions.js')
    >();
  return {
    ...actual,
    migrateLockfileFileIds: vi.fn(),
    readLockfile: vi.fn(),
    writeLockfile: vi.fn(),
  };
});

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

  const mockBranchData: BranchData = {
    currentBranch: { id: 'branch-123', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readLockfile).mockReturnValue({
      data: { version: 2, branchId: 'branch-123', entries: [] },
      entryMap: new Map(),
      originalV1: null,
    });
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

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

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
      expect(migrateLockfileFileIds).toHaveBeenCalledWith('branch-123', [
        {
          oldFileId: 'old-file-id-hash',
          newFileId: 'new-file-id-hash',
          newFileName: 'locales/en.json',
        },
      ]);
    });

    it('migrates a Windows path identity with changed content on Windows', async () => {
      const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;
      const localFiles: FileToUpload[] = [
        {
          content: 'new content',
          fileName: 'src/content/page.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'portable-id',
          versionId: 'new-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'windows-id',
            versionId: 'old-version',
            fileName: 'src\\content\\page.mdx',
          },
        ],
      });
      mockGt.processFileMoves.mockResolvedValue({
        results: [
          {
            oldFileId: 'windows-id',
            newFileId: 'portable-id',
            success: true,
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [
          {
            fileId: 'portable-id',
            versionId: 'new-version',
            branchId: 'branch-123',
            fileName: 'src/content/page.mdx',
            fileFormat: 'MDX',
            locale: 'en',
          },
        ],
        count: 1,
      });

      try {
        Object.defineProperty(path, 'sep', {
          ...originalSeparator,
          value: path.win32.sep,
        });
        const step = new UploadSourcesStep(mockGt, mockSettings);
        await step.run({ files: localFiles, branchData: mockBranchData });
      } finally {
        Object.defineProperty(path, 'sep', originalSeparator);
      }

      expect(mockGt.processFileMoves).toHaveBeenCalledWith(
        [
          {
            oldFileId: 'windows-id',
            newFileId: 'portable-id',
            newFileName: 'src/content/page.mdx',
          },
        ],
        { branchId: 'branch-123' }
      );
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({
              fileId: 'portable-id',
              versionId: 'new-version',
            }),
          }),
        ],
        expect.any(Object)
      );
      expect(migrateLockfileFileIds).toHaveBeenCalledWith('branch-123', [
        {
          oldFileId: 'windows-id',
          newFileId: 'portable-id',
          newFileName: 'src/content/page.mdx',
        },
      ]);
    });

    it('does not treat a literal POSIX backslash as a path separator', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'literal backslash file',
          fileName: 'src/literal\\page.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'literal-id',
          versionId: 'literal-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'slash-id',
            versionId: 'different-version',
            fileName: 'src/literal/page.mdx',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'literal-id' }),
          }),
        ],
        expect.any(Object)
      );
    });

    it('does not normalize a mixed-separator POSIX orphan path', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'portable path',
          fileName: 'src/content/page.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'portable-id',
          versionId: 'new-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'literal-id',
            versionId: 'old-version',
            fileName: 'src\\content/page.mdx',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'portable-id' }),
          }),
        ],
        expect.any(Object)
      );
    });

    it.skipIf(path.sep === '\\')(
      'does not borrow an all-backslash orphan while that literal POSIX path exists',
      async () => {
        const existsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const localFiles: FileToUpload[] = [
          {
            content: 'portable path',
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            locale: 'en',
            fileId: 'portable-id',
            versionId: 'new-version',
          },
        ];

        mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
        mockGt.getOrphanedFiles.mockResolvedValue({
          orphanedFiles: [
            {
              fileId: 'literal-id',
              versionId: 'old-version',
              fileName: 'docs\\doc.md',
            },
          ],
        });
        mockGt.uploadSourceFiles.mockResolvedValue({
          uploadedFiles: [],
          count: 0,
        });

        try {
          const step = new UploadSourcesStep(mockGt, mockSettings);
          await step.run({ files: localFiles, branchData: mockBranchData });
        } finally {
          existsSync.mockRestore();
        }

        expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      }
    );

    it.skipIf(path.sep === '\\')(
      'does not borrow an absent literal POSIX orphan with different content',
      async () => {
        const existsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const localFiles: FileToUpload[] = [
          {
            content: 'new portable file',
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            locale: 'en',
            fileId: 'portable-id',
            versionId: 'new-version',
          },
        ];

        mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
        mockGt.getOrphanedFiles.mockResolvedValue({
          orphanedFiles: [
            {
              fileId: 'literal-id',
              versionId: 'old-version',
              fileName: 'docs\\doc.md',
            },
          ],
        });
        mockGt.uploadSourceFiles.mockResolvedValue({
          uploadedFiles: [],
          count: 0,
        });

        try {
          const step = new UploadSourcesStep(mockGt, mockSettings);
          await step.run({ files: localFiles, branchData: mockBranchData });
        } finally {
          existsSync.mockRestore();
        }

        expect(mockGt.processFileMoves).not.toHaveBeenCalled();
        expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              source: expect.objectContaining({ fileId: 'portable-id' }),
            }),
          ],
          expect.any(Object)
        );
      }
    );

    it.skipIf(path.sep === '\\')(
      'does not reassign an ambiguous stale alias by its old content hash',
      async () => {
        const existsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const localFiles: FileToUpload[] = [
          {
            content: 'changed current content',
            fileName: 'existing/a.mdx',
            fileFormat: 'MDX',
            locale: 'en',
            fileId: 'current-a',
            versionId: 'new-a-version',
          },
          {
            content: 'same as the stale alias',
            fileName: 'new/b.mdx',
            fileFormat: 'MDX',
            locale: 'en',
            fileId: 'new-b',
            versionId: 'old-a-version',
          },
        ];

        mockGt.queryFileData.mockResolvedValue({
          sourceFiles: [
            {
              branchId: 'branch-123',
              fileId: 'current-a',
              versionId: 'new-a-version',
            },
          ],
        });
        mockGt.getOrphanedFiles.mockResolvedValue({
          orphanedFiles: [
            {
              fileId: 'legacy-a',
              versionId: 'old-a-version',
              fileName: 'existing\\a.mdx',
            },
          ],
        });
        mockGt.uploadSourceFiles.mockResolvedValue({
          uploadedFiles: [],
          count: 0,
        });

        try {
          const step = new UploadSourcesStep(mockGt, mockSettings);
          await step.run({ files: localFiles, branchData: mockBranchData });
        } finally {
          existsSync.mockRestore();
        }

        expect(mockGt.processFileMoves).not.toHaveBeenCalled();
        expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              source: expect.objectContaining({ fileId: 'new-b' }),
            }),
          ],
          expect.any(Object)
        );
      }
    );

    it.skipIf(path.sep === '\\')(
      'does not replace a path-hinted orphan with an unrelated content match',
      async () => {
        const existsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const localFile: FileToUpload = {
          content: 'matches unrelated orphan',
          fileName: 'docs/page.md',
          fileFormat: 'MD',
          locale: 'en',
          fileId: 'current-id',
          versionId: 'matching-version',
        };

        mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
        mockGt.getOrphanedFiles.mockResolvedValue({
          orphanedFiles: [
            {
              fileId: 'path-hinted-id',
              versionId: 'changed-version',
              fileName: 'docs\\page.md',
            },
            {
              fileId: 'unrelated-id',
              versionId: 'matching-version',
              fileName: 'old/other.md',
            },
          ],
        });
        mockGt.uploadSourceFiles.mockResolvedValue({
          uploadedFiles: [],
          count: 0,
        });

        try {
          const step = new UploadSourcesStep(mockGt, mockSettings);
          await step.run({ files: [localFile], branchData: mockBranchData });
        } finally {
          existsSync.mockRestore();
        }

        expect(mockGt.processFileMoves).not.toHaveBeenCalled();
        expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              source: expect.objectContaining({ fileId: 'current-id' }),
            }),
          ],
          expect.any(Object)
        );
      }
    );

    it.skipIf(path.sep === '\\')(
      'does not use a POSIX path hint to break a duplicate-content tie',
      async () => {
        const existsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
        const localFiles: FileToUpload[] = [
          {
            content: 'same',
            fileName: 'docs/doc.md',
            fileFormat: 'MD',
            locale: 'en',
            fileId: 'portable-id',
            versionId: 'same-version',
          },
          {
            content: 'same',
            fileName: 'other.md',
            fileFormat: 'MD',
            locale: 'en',
            fileId: 'other-id',
            versionId: 'same-version',
          },
        ];

        mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
        mockGt.getOrphanedFiles.mockResolvedValue({
          orphanedFiles: [
            {
              fileId: 'literal-id',
              versionId: 'same-version',
              fileName: 'docs\\doc.md',
            },
          ],
        });
        mockGt.uploadSourceFiles.mockResolvedValue({
          uploadedFiles: [],
          count: 0,
        });

        try {
          const step = new UploadSourcesStep(mockGt, mockSettings);
          await step.run({ files: localFiles, branchData: mockBranchData });
        } finally {
          existsSync.mockRestore();
        }

        expect(mockGt.processFileMoves).not.toHaveBeenCalled();
        expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              source: expect.objectContaining({ fileId: 'portable-id' }),
            }),
            expect.objectContaining({
              source: expect.objectContaining({ fileId: 'other-id' }),
            }),
          ]),
          expect.any(Object)
        );
      }
    );

    it('does not guess between identical-content move candidates', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'same',
          fileName: 'new/a.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'new-a',
          versionId: 'same-version',
        },
        {
          content: 'same',
          fileName: 'new/b.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'new-b',
          versionId: 'same-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-a',
            versionId: 'same-version',
            fileName: 'old/a.mdx',
          },
          {
            fileId: 'old-b',
            versionId: 'same-version',
            fileName: 'old/b.mdx',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'new-a' }),
          }),
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'new-b' }),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('keeps server-confirmed locals as content-match ambiguity consumers', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'same content',
          fileName: 'existing/a.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'existing-a',
          versionId: 'same-version',
        },
        {
          content: 'same content',
          fileName: 'new/b.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'new-b',
          versionId: 'same-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [
          {
            branchId: 'branch-123',
            fileId: 'existing-a',
            versionId: 'same-version',
          },
        ],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-b',
            versionId: 'same-version',
            fileName: 'old/b.mdx',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'new-b' }),
          }),
        ],
        expect.any(Object)
      );
    });

    it('does not let a stale alias bypass duplicate-content ambiguity', async () => {
      const localFiles: FileToUpload[] = [
        {
          content: 'same content',
          fileName: 'existing/a.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'current-a',
          versionId: 'same-version',
        },
        {
          content: 'same content',
          fileName: 'new/b.mdx',
          fileFormat: 'MDX',
          locale: 'en',
          fileId: 'new-b',
          versionId: 'same-version',
        },
      ];

      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [
          {
            branchId: 'branch-123',
            fileId: 'current-a',
            versionId: 'same-version',
          },
        ],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'legacy-a',
            versionId: 'same-version',
            fileName: 'existing\\a.mdx',
          },
        ],
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

      expect(mockGt.processFileMoves).not.toHaveBeenCalled();
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'new-b' }),
          }),
        ],
        expect.any(Object)
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

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

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

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

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

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

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

    it('falls back to uploading when the server rejects a detected move', async () => {
      const localFile: FileToUpload = {
        content: 'content',
        fileName: 'new/page.mdx',
        fileFormat: 'MDX',
        locale: 'en',
        fileId: 'new-file-id',
        versionId: 'same-version',
      };
      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({
        orphanedFiles: [
          {
            fileId: 'old-file-id',
            versionId: 'same-version',
            fileName: 'old/page.mdx',
          },
        ],
      });
      mockGt.processFileMoves.mockResolvedValue({
        results: [
          {
            oldFileId: 'old-file-id',
            newFileId: 'new-file-id',
            success: false,
            error: 'move rejected',
          },
        ],
        summary: { total: 1, succeeded: 0, failed: 1 },
      });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [
          {
            ...localFile,
            branchId: 'branch-123',
          },
        ],
        count: 1,
      });

      const result = await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [localFile],
        branchData: mockBranchData,
      });

      expect(migrateLockfileFileIds).toHaveBeenCalledWith('branch-123', []);
      expect(mockGt.uploadSourceFiles).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            source: expect.objectContaining({ fileId: 'new-file-id' }),
          }),
        ],
        expect.any(Object)
      );
      expect(result).toContainEqual(
        expect.objectContaining({ fileId: 'new-file-id' })
      );
    });

    it('accepts only exact branch and version confirmations from uploads', async () => {
      const localFile: FileToUpload = {
        content: 'content',
        fileName: 'docs/page.md',
        fileFormat: 'MD',
        locale: 'en',
        fileId: 'file-id',
        versionId: 'version-id',
      };
      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({ orphanedFiles: [] });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [
          { ...localFile, branchId: 'other-branch' },
          {
            ...localFile,
            branchId: 'branch-123',
            versionId: 'other-version',
          },
          { ...localFile, branchId: 'branch-123' },
        ],
        count: 3,
      });

      const result = await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [localFile],
        branchData: mockBranchData,
      });

      expect(result).toEqual([
        expect.objectContaining({
          branchId: 'branch-123',
          fileId: 'file-id',
          versionId: 'version-id',
        }),
      ]);
    });

    it('retires a legacy alias after the current source is confirmed', async () => {
      const localFile: FileToUpload = {
        content: 'content',
        fileName: 'docs/page.md',
        fileFormat: 'MD',
        locale: 'en',
        fileId: 'current-id',
        versionId: 'current-version',
      };
      const entry = {
        fileId: 'current-id',
        previousFileId: 'legacy-id',
        versionId: 'current-version',
        translations: { es: { postProcessHash: 'legacy-hash' } },
      };
      const data = {
        version: 2 as const,
        branchId: 'branch-123',
        entries: [entry],
      };
      vi.mocked(readLockfile).mockReturnValue({
        data,
        entryMap: new Map([
          ['current-id', entry],
          ['legacy-id', entry],
        ]),
        originalV1: null,
      });
      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [
          {
            branchId: 'branch-123',
            fileId: 'current-id',
            versionId: 'current-version',
          },
        ],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({ orphanedFiles: [] });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const result = await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [localFile],
        branchData: mockBranchData,
      });

      expect(result).toContainEqual(
        expect.objectContaining({ fileId: 'current-id' })
      );
      expect(entry.previousFileId).toBeUndefined();
      expect(entry.translations).toEqual({});
      expect(writeLockfile).toHaveBeenCalledWith(data, null);
    });

    it('can defer alias retirement until local edits use its history', async () => {
      const localFile: FileToUpload = {
        content: 'content',
        fileName: 'docs/page.md',
        fileFormat: 'MD',
        locale: 'en',
        fileId: 'current-id',
        versionId: 'current-version',
      };
      const entry = {
        fileId: 'current-id',
        previousFileId: 'legacy-id',
        versionId: 'current-version',
        translations: { es: { postProcessHash: 'legacy-hash' } },
      };
      const data = {
        version: 2 as const,
        branchId: 'branch-123',
        entries: [entry],
      };
      vi.mocked(readLockfile).mockReturnValue({
        data,
        entryMap: new Map([
          ['current-id', entry],
          ['legacy-id', entry],
        ]),
        originalV1: null,
      });
      mockGt.queryFileData.mockResolvedValue({
        sourceFiles: [
          {
            branchId: 'branch-123',
            fileId: 'current-id',
            versionId: 'current-version',
          },
        ],
      });
      mockGt.getOrphanedFiles.mockResolvedValue({ orphanedFiles: [] });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const step = new UploadSourcesStep(mockGt, mockSettings);
      const result = await step.run({
        files: [localFile],
        branchData: mockBranchData,
        deferIdentityActivation: true,
      });

      expect(entry.previousFileId).toBe('legacy-id');
      expect(entry.translations).toEqual({
        es: { postProcessHash: 'legacy-hash' },
      });
      expect(writeLockfile).not.toHaveBeenCalled();

      step.activateConfirmedFileIdentities(result, 'branch-123');

      expect(entry.previousFileId).toBeUndefined();
      expect(entry.translations).toEqual({});
      expect(writeLockfile).toHaveBeenCalledWith(data, null);
    });

    it('keeps a legacy alias when the current source upload is omitted', async () => {
      const localFile: FileToUpload = {
        content: 'content',
        fileName: 'docs/page.md',
        fileFormat: 'MD',
        locale: 'en',
        fileId: 'current-id',
        versionId: 'current-version',
      };
      const entry = {
        fileId: 'current-id',
        previousFileId: 'legacy-id',
        versionId: 'current-version',
        translations: { es: { postProcessHash: 'legacy-hash' } },
      };
      vi.mocked(readLockfile).mockReturnValue({
        data: {
          version: 2,
          branchId: 'branch-123',
          entries: [entry],
        },
        entryMap: new Map([
          ['current-id', entry],
          ['legacy-id', entry],
        ]),
        originalV1: null,
      });
      mockGt.queryFileData.mockResolvedValue({ sourceFiles: [] });
      mockGt.getOrphanedFiles.mockResolvedValue({ orphanedFiles: [] });
      mockGt.uploadSourceFiles.mockResolvedValue({
        uploadedFiles: [],
        count: 0,
      });

      const result = await new UploadSourcesStep(mockGt, mockSettings).run({
        files: [localFile],
        branchData: mockBranchData,
      });

      expect(result).toEqual([]);
      expect(entry.previousFileId).toBe('legacy-id');
      expect(entry.translations).toEqual({
        es: { postProcessHash: 'legacy-hash' },
      });
      expect(writeLockfile).not.toHaveBeenCalled();
    });

    it('should handle empty files array', async () => {
      const step = new UploadSourcesStep(mockGt, mockSettings);
      const result = await step.run({
        files: [],
        branchData: mockBranchData,
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

      const step = new UploadSourcesStep(mockGt, mockSettings);
      await step.run({ files: localFiles, branchData: mockBranchData });

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

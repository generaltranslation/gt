import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';
import type { Settings } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import { clearWarnings, recordWarning } from '../../state/translateWarnings.js';
import { runUploadFilesWorkflow } from '../upload.js';

vi.mock('../../console/logger.js', () => ({
  logger: { message: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));
vi.mock('../../utils/api.js', () => ({
  createClients: () => ({ project: {} }),
}));
vi.mock('../utils/syncFonts.js', () => ({ syncFonts: vi.fn() }));
vi.mock('../steps/BranchStep.js', () => ({
  BranchStep: vi.fn(() => ({
    run: vi.fn(async () => ({ currentBranch: { id: 'branch-1' } })),
  })),
}));
const { uploadSourcesRun, uploadTranslationsRun } = vi.hoisted(() => ({
  uploadSourcesRun: vi.fn(),
  uploadTranslationsRun: vi.fn(),
}));
vi.mock('../steps/UploadSourcesStep.js', () => ({
  UploadSourcesStep: vi.fn(() => ({ run: uploadSourcesRun })),
}));
vi.mock('../steps/UploadTranslationsStep.js', () => ({
  UploadTranslationsStep: vi.fn(() => ({ run: uploadTranslationsRun })),
}));

const source = (name: string): FileToUpload => ({
  content: name,
  fileName: name,
  fileFormat: 'JSON',
  locale: 'en',
  fileId: `id:${name}`,
  versionId: `v:${name}`,
});

describe('runUploadFilesWorkflow', () => {
  const files = [
    { source: source('a.json'), translations: [] },
    { source: source('b.json'), translations: [] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
  });

  it('returns the saved source files and reports success when nothing failed', async () => {
    const saved = [{ ...source('a.json'), branchId: 'branch-1' }];
    uploadSourcesRun.mockResolvedValue(saved);

    const result = await runUploadFilesWorkflow({
      files,
      options: {} as Settings,
    });

    expect(result.uploadedFiles).toBe(saved);
    expect(logger.success).toHaveBeenCalledWith(
      'All files uploaded successfully'
    );
  });

  it('does not claim success when an upload failed', async () => {
    uploadSourcesRun.mockImplementation(async () => {
      recordWarning('failed_upload', 'b.json', 'storage unavailable');
      return [{ ...source('a.json'), branchId: 'branch-1' }];
    });

    await runUploadFilesWorkflow({ files, options: {} as Settings });

    expect(logger.success).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Some files could not be uploaded')
    );
  });

  it('uploads translations only for sources the platform holds', async () => {
    const translation = (name: string): FileToUpload => ({
      ...source(name),
      locale: 'ja',
    });
    const withTranslations = [
      { source: source('a.json'), translations: [translation('a.json')] },
      { source: source('b.json'), translations: [translation('b.json')] },
    ];
    uploadSourcesRun.mockImplementation(async () => {
      recordWarning('failed_upload', 'b.json', 'storage unavailable');
      return [{ ...source('a.json'), branchId: 'branch-1' }];
    });

    await runUploadFilesWorkflow({
      files: withTranslations,
      options: {} as Settings,
    });

    expect(uploadTranslationsRun).toHaveBeenCalledWith({
      files: [
        {
          ...withTranslations[0],
          source: { ...withTranslations[0].source, branchId: 'branch-1' },
        },
      ],
    });
  });

  it('uploads translations against the resolved current branch', async () => {
    const translation = { ...source('a.json'), locale: 'fr' };
    uploadSourcesRun.mockResolvedValue([
      { ...source('a.json'), branchId: 'branch-1' },
    ]);

    await runUploadFilesWorkflow({
      files: [{ source: source('a.json'), translations: [translation] }],
      options: {} as Settings,
    });

    expect(uploadTranslationsRun).toHaveBeenCalledWith({
      files: [
        {
          source: { ...source('a.json'), branchId: 'branch-1' },
          translations: [translation],
        },
      ],
    });
  });

  it('skips the translation upload when no source was saved', async () => {
    uploadSourcesRun.mockResolvedValue([]);

    await runUploadFilesWorkflow({
      files: [
        {
          source: source('a.json'),
          translations: [{ ...source('a.json'), locale: 'ja' }],
        },
      ],
      options: {} as Settings,
    });

    expect(uploadTranslationsRun).not.toHaveBeenCalled();
  });
});

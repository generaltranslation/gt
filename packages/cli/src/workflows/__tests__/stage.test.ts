import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';
import type { Settings, TranslateFlags } from '../../types/index.js';
import { runStageFilesWorkflow } from '../stage.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock('../../console/logging.js', () => ({
  logCollectedFiles: vi.fn(),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));
vi.mock('../../utils/api.js', () => ({
  api: { uploadFonts: vi.fn(async () => ({ assets: [], count: 2 })) },
}));
vi.mock('../../formats/files/collectFonts.js', () => ({
  collectFonts: vi.fn(async () => []),
}));
vi.mock('../steps/BranchStep.js', () => ({
  BranchStep: vi.fn(() => ({
    run: vi.fn(async () => ({ currentBranch: { id: 'branch-1' } })),
    wait: vi.fn(),
  })),
}));
vi.mock('../steps/UploadSourcesStep.js', () => ({
  UploadSourcesStep: vi.fn(() => ({
    run: vi.fn(async () => []),
    wait: vi.fn(),
  })),
}));
vi.mock('../steps/SetupStep.js', () => ({
  SetupStep: vi.fn(() => ({ run: vi.fn(), wait: vi.fn() })),
}));
vi.mock('../steps/EnqueueStep.js', () => ({
  EnqueueStep: vi.fn(() => ({
    run: vi.fn(async () => ({ message: 'enqueued', jobData: {} })),
    wait: vi.fn(),
  })),
}));
vi.mock('../steps/TagStep.js', () => ({
  TagStep: vi.fn(() => ({ run: vi.fn(), wait: vi.fn() })),
}));
vi.mock('../steps/UserEditDiffsStep.js', () => ({
  UserEditDiffsStep: vi.fn(() => ({ run: vi.fn(), wait: vi.fn() })),
}));
vi.mock('../utils/filterFilesForEnqueue.js', () => ({
  filterFilesForEnqueue: vi.fn(async ({ files }: { files: unknown[] }) => ({
    filesToEnqueue: files,
    skippedFiles: [],
  })),
}));

import { api } from '../../utils/api.js';
import { collectFonts } from '../../formats/files/collectFonts.js';
import { logger } from '../../console/logger.js';

const files: FileToUpload[] = [
  {
    content: 'aGVsbG8=',
    fileName: 'src/en/anim.lottie',
    fileFormat: 'LOTTIE',
    fileId: 'file-1',
    versionId: 'version-1',
    locale: 'en',
  },
];
const options = { timeout: '600' } as TranslateFlags;
const settings = { locales: ['es'] } as Settings;

describe('runStageFilesWorkflow font sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads configured fonts before enqueueing', async () => {
    const fonts = [
      {
        assetType: 'FONT' as const,
        fileName: 'Inter.ttf',
        content: 'Zm9udA==',
      },
    ];
    vi.mocked(collectFonts).mockResolvedValue(fonts);

    const result = await runStageFilesWorkflow({ files, options, settings });

    expect(collectFonts).toHaveBeenCalledWith(settings);
    expect(api.uploadFonts).toHaveBeenCalledWith(fonts);
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });

  it('skips the upload when no fonts are configured', async () => {
    vi.mocked(collectFonts).mockResolvedValue([]);

    await runStageFilesWorkflow({ files, options, settings });

    expect(api.uploadFonts).not.toHaveBeenCalled();
  });

  it('continues staging when the font upload fails', async () => {
    vi.mocked(collectFonts).mockResolvedValue([
      { assetType: 'FONT', fileName: 'Inter.ttf', content: 'Zm9udA==' },
    ]);
    vi.mocked(api.uploadFonts).mockRejectedValueOnce(new Error('server down'));

    const result = await runStageFilesWorkflow({ files, options, settings });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Font sync failed')
    );
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });
});

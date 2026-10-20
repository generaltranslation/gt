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
  api: {
    upsertAssets: vi.fn(async () => ({
      summary: { total: 0, succeeded: 0, failed: 0 },
      results: [],
    })),
  },
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
    run: vi.fn(async ({ files }: { files: unknown[] }) => files),
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
const { userEditDiffsRun } = vi.hoisted(() => ({
  userEditDiffsRun: vi.fn(),
}));
vi.mock('../steps/UserEditDiffsStep.js', () => ({
  UserEditDiffsStep: vi.fn(() => ({ run: userEditDiffsRun, wait: vi.fn() })),
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
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';

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
    expect(api.upsertAssets).toHaveBeenCalledWith(fonts);
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });

  it('skips the upload when no fonts are configured', async () => {
    vi.mocked(collectFonts).mockResolvedValue([]);

    await runStageFilesWorkflow({ files, options, settings });

    expect(api.upsertAssets).not.toHaveBeenCalled();
  });

  it('continues staging when the font upload fails', async () => {
    vi.mocked(collectFonts).mockResolvedValue([
      { assetType: 'FONT', fileName: 'Inter.ttf', content: 'Zm9udA==' },
    ]);
    vi.mocked(api.upsertAssets).mockRejectedValueOnce(new Error('server down'));

    const result = await runStageFilesWorkflow({ files, options, settings });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Font sync failed')
    );
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });

  it('records fonts the API failed to save and keeps the saved ones', async () => {
    clearWarnings();
    vi.mocked(collectFonts).mockResolvedValue([
      { assetType: 'FONT', fileName: 'Inter.ttf', content: 'Zm9udA==' },
      { assetType: 'FONT', fileName: 'Broken.ttf', content: 'Zm9udA==' },
    ]);
    vi.mocked(api.upsertAssets).mockResolvedValueOnce({
      summary: { total: 2, succeeded: 1, failed: 1 },
      results: [
        {
          fileName: 'Inter.ttf',
          status: 'succeeded',
          id: 'asset-1',
          assetKey: 'Inter:400',
        },
        { fileName: 'Broken.ttf', status: 'failed', error: 'no family' },
      ],
    });

    const result = await runStageFilesWorkflow({ files, options, settings });

    expect(logger.success).toHaveBeenCalledWith('Synced 1 font(s)');
    expect(logger.warn).toHaveBeenCalledWith(
      'Font sync failed for Broken.ttf; continuing without it: no family'
    );
    expect(getWarnings()).toEqual([
      {
        category: 'failed_upload',
        fileName: 'Broken.ttf',
        reason: 'no family',
      },
    ]);
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });
});

describe('runStageFilesWorkflow save-local gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectFonts).mockResolvedValue([]);
  });

  it('saves local edits when options.saveLocal is true', async () => {
    await runStageFilesWorkflow({
      files,
      options,
      settings: { ...settings, options: { saveLocal: true } } as Settings,
    });

    expect(userEditDiffsRun).toHaveBeenCalledTimes(1);
    expect(userEditDiffsRun).toHaveBeenCalledWith(files);
  });

  it('skips saving local edits when options.saveLocal is false', async () => {
    const result = await runStageFilesWorkflow({
      files,
      options,
      settings: { ...settings, options: { saveLocal: false } } as Settings,
    });

    expect(userEditDiffsRun).not.toHaveBeenCalled();
    // The rest of the workflow still runs
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });

  it('skips saving local edits when options.saveLocal is not set', async () => {
    const result = await runStageFilesWorkflow({ files, options, settings });

    expect(userEditDiffsRun).not.toHaveBeenCalled();
    expect(result.enqueueResult).toEqual({ message: 'enqueued', jobData: {} });
  });

  it('ignores the raw flag and uses the resolved setting', async () => {
    // generateSettings folds the flag into settings.options.saveLocal; the
    // workflow must not read the unresolved flag directly.
    await runStageFilesWorkflow({
      files,
      options: { ...options, saveLocal: true } as TranslateFlags,
      settings: { ...settings, options: { saveLocal: false } } as Settings,
    });

    expect(userEditDiffsRun).not.toHaveBeenCalled();
  });
});

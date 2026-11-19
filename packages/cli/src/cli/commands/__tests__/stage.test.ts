import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import { createMockSettings } from '../../../api/__mocks__/settings.js';
import {
  TEMPLATE_FILE_ID,
  TEMPLATE_FILE_NAME,
} from '../../../utils/constants.js';
import { handleStage } from '../stage.js';
import { collectFiles } from '../../../formats/files/collectFiles.js';
import { runStageFilesWorkflow } from '../../../workflows/stage.js';
import updateConfig from '../../../fs/config/updateConfig.js';
import { collectParaglideContext } from '../../../paraglide/collectParaglideContext.js';
import { writeStagedEntries } from '../../../fs/config/downloadedVersions.js';
import { logger } from '../../../console/logger.js';
import { ApiError } from 'generaltranslation/errors';

vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: vi.fn(),
}));

vi.mock('../../../paraglide/collectParaglideContext.js', () => ({
  collectParaglideContext: vi.fn(),
}));

vi.mock('../../../workflows/stage.js', () => ({
  runStageFilesWorkflow: vi.fn(),
}));

vi.mock('../../../fs/config/downloadedVersions.js', () => ({
  writeStagedEntries: vi.fn(),
}));

vi.mock('../../../fs/config/updateConfig.js', () => ({
  default: vi.fn(),
}));

vi.mock('../utils/validation.js', () => ({
  hasValidCredentials: vi.fn(() => true),
  hasValidLocales: vi.fn(() => true),
}));

vi.mock('../../../translation/reviewSetupWarning.js', () => ({
  warnManualReviewSetup: vi.fn(),
}));

vi.mock('../../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn(),
  logCollectedFiles: vi.fn(),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

const branchData = {
  currentBranch: { id: 'branch-1', name: 'main' },
  incomingBranch: null,
  checkedOutBranch: null,
};

const templateFile = {
  fileName: TEMPLATE_FILE_NAME,
  content: '{}',
  fileFormat: 'GTJSON',
  fileId: TEMPLATE_FILE_ID,
  versionId: 'version-1',
  locale: 'en',
} satisfies FileToUpload;

const options = {
  dryRun: false,
  timeout: 1,
} as TranslateFlags;

function settings(overrides: Partial<Settings> = {}): Settings {
  return createMockSettings({
    config: '/project/gt.config.json',
    locales: ['es'],
    defaultLocale: 'en',
    branchOptions: {
      enabled: true,
      autoDetectBranches: true,
      remoteName: 'origin',
    },
    ...overrides,
  });
}

describe('handleStage config ids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectFiles).mockResolvedValue({
      files: [templateFile],
      reactComponents: 1,
      publishMap: new Map(),
    });
    vi.mocked(runStageFilesWorkflow).mockResolvedValue({
      branchData,
      enqueueResult: {
        jobData: {},
        locales: ['es'],
        message: 'No files need to be enqueued',
      },
    });
  });

  it('writes config ids by default', async () => {
    await handleStage(options, settings(), 'gt-react', false);

    expect(updateConfig).toHaveBeenCalledWith('/project/gt.config.json', {
      _versionId: 'version-1',
      _branchId: 'branch-1',
    });
  });

  it('returns the collected inline runtime for downstream status labels', async () => {
    vi.mocked(collectFiles).mockResolvedValue({
      files: [templateFile],
      reactComponents: 1,
      inlineLibrary: 'gt-vue',
      publishMap: new Map(),
    });

    const result = await handleStage(options, settings(), 'gt-vue', false);

    expect(result?.inlineLibrary).toBe('gt-vue');
  });

  it('removes existing config ids and skips writing new ids when omitted', async () => {
    await handleStage(
      options,
      settings({
        omitConfigIds: true,
        _versionId: 'old-version',
        _branchId: 'old-branch',
      }),
      'gt-react',
      false
    );

    expect(updateConfig).toHaveBeenCalledWith('/project/gt.config.json', {
      _versionId: null,
      _branchId: null,
    });
    expect(updateConfig).not.toHaveBeenCalledWith('/project/gt.config.json', {
      _versionId: 'version-1',
      _branchId: 'branch-1',
    });
  });

  it('keeps existing config ids when no files are collected', async () => {
    vi.mocked(collectFiles).mockResolvedValue({
      files: [],
      reactComponents: 0,
      publishMap: new Map(),
    });

    await handleStage(
      options,
      settings({
        omitConfigIds: true,
        _versionId: 'old-version',
        _branchId: 'old-branch',
      }),
      'gt-react',
      false
    );

    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('keeps existing config ids when the stage workflow fails', async () => {
    vi.mocked(runStageFilesWorkflow).mockRejectedValue(
      new Error('network error')
    );

    await expect(
      handleStage(
        options,
        settings({
          omitConfigIds: true,
          _versionId: 'old-version',
          _branchId: 'old-branch',
        }),
        'gt-react',
        false
      )
    ).rejects.toThrow('network error');

    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('does not touch the config during a dry run when ids are omitted', async () => {
    await handleStage(
      { ...options, dryRun: true },
      settings({ omitConfigIds: true, _versionId: 'old-version' }),
      'gt-react',
      false
    );

    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('collects Paraglide context before the files when the json flag is set', async () => {
    const base = settings();

    await handleStage(
      options,
      {
        ...base,
        files: {
          ...base.files,
          parsingFlags: { json: { includeSourceCodeContext: true } },
        },
      },
      'gt-react',
      false
    );

    expect(collectParaglideContext).toHaveBeenCalledOnce();
    expect(
      vi.mocked(collectParaglideContext).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(collectFiles).mock.invocationCallOrder[0]);
  });

  it('does not collect Paraglide context when the json flag is not set', async () => {
    await handleStage(options, settings(), 'gt-react', false);

    expect(collectParaglideContext).not.toHaveBeenCalled();
  });
});

describe('handleStage billing limits', () => {
  const billingLimitError = new ApiError(
    'Spend limit reached',
    402,
    'Spend limit reached'
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectFiles).mockResolvedValue({
      files: [templateFile],
      reactComponents: 1,
      publishMap: new Map(),
    });
    vi.mocked(runStageFilesWorkflow).mockResolvedValue({
      branchData,
      billingLimitError,
    });
  });

  it('fails translate by default and points at --fallback-download', async () => {
    await expect(
      handleStage(options, settings(), 'gt-react', false)
    ).rejects.toThrow(
      /New translations could not be queued.*--fallback-download/
    );

    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('returns file versions for a fallback download without pinning config ids', async () => {
    const result = await handleStage(
      { ...options, fallbackDownload: true },
      settings(),
      'gt-react',
      false
    );

    expect(result).toMatchObject({
      jobData: undefined,
      branchData,
      billingLimitError,
      fileVersionData: {
        [TEMPLATE_FILE_ID]: { versionId: 'version-1' },
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Existing translations will still be downloaded')
    );
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it('fails staging without writing staged entries', async () => {
    const thrown = await handleStage(
      { ...options, fallbackDownload: true },
      settings(),
      'gt-react',
      true
    ).catch((error: Error) => error);

    expect((thrown as Error).message).toMatch(
      /New translations could not be queued/
    );
    expect((thrown as Error).message).not.toContain('--fallback-download');
    expect(writeStagedEntries).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
  });
});

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

vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: vi.fn(),
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

vi.mock('../../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn(),
  logCollectedFiles: vi.fn(),
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
});

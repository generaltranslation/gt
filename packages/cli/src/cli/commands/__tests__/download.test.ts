import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import { createMockSettings } from '../../../api/__mocks__/settings.js';
import {
  TEMPLATE_FILE_ID,
  TEMPLATE_FILE_NAME,
} from '../../../utils/constants.js';
import { handleDownload } from '../download.js';
import { collectFiles } from '../../../formats/files/collectFiles.js';
import { runDownloadWorkflow } from '../../../workflows/download.js';
import { logErrorAndExit } from '../../../console/logging.js';
import { noVersionIdError } from '../../../console/index.js';

vi.mock('../../../formats/files/collectFiles.js', () => ({
  collectFiles: vi.fn(),
}));

vi.mock('../../../workflows/download.js', () => ({
  runDownloadWorkflow: vi.fn(),
}));

vi.mock('../../../fs/config/downloadedVersions.js', () => ({
  getStagedEntriesFromLockfile: vi.fn(() => ({})),
}));

vi.mock('../../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(() => ({})),
}));

vi.mock('../utils/validation.js', () => ({
  hasValidCredentials: vi.fn(() => true),
  hasValidLocales: vi.fn(() => true),
}));

vi.mock('../../../console/logging.js', () => ({
  exitSync: vi.fn(),
  logErrorAndExit: vi.fn(),
}));

const gtjsonFile = {
  fileName: TEMPLATE_FILE_NAME,
  content: '{}',
  fileFormat: 'GTJSON',
  fileId: TEMPLATE_FILE_ID,
  versionId: 'content-derived-version',
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
    stageTranslations: false,
    ...overrides,
  });
}

describe('handleDownload GTJSON versionId guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectFiles).mockResolvedValue({
      files: [gtjsonFile],
      reactComponents: 1,
      publishMap: new Map(),
    });
  });

  it('does not require _versionId when config ids are omitted (regression)', async () => {
    // omitConfigIds intentionally never writes _versionId; the collected GTJSON
    // already carries its own content-derived versionId, so the download must
    // proceed rather than fail.
    await handleDownload(
      options,
      settings({ omitConfigIds: true }),
      'gt-react'
    );

    expect(logErrorAndExit).not.toHaveBeenCalled();
    expect(runDownloadWorkflow).toHaveBeenCalledOnce();
  });

  it('still errors for a GTJSON download with config ids but no _versionId', async () => {
    await handleDownload(
      options,
      settings({ omitConfigIds: false }),
      'gt-react'
    );

    expect(logErrorAndExit).toHaveBeenCalledWith(noVersionIdError);
    expect(runDownloadWorkflow).not.toHaveBeenCalled();
  });

  it('proceeds when a _versionId is present in config-id mode', async () => {
    await handleDownload(
      options,
      settings({ omitConfigIds: false, _versionId: 'staged-version' }),
      'gt-react'
    );

    expect(logErrorAndExit).not.toHaveBeenCalled();
    expect(runDownloadWorkflow).toHaveBeenCalledOnce();
  });

  it('passes the collected inline runtime to the download workflow', async () => {
    vi.mocked(collectFiles).mockResolvedValue({
      files: [gtjsonFile],
      reactComponents: 1,
      inlineLibrary: 'gt-vue',
      publishMap: new Map(),
    });

    await handleDownload(options, settings({ omitConfigIds: true }), 'gt-vue');

    expect(runDownloadWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ inlineLibrary: 'gt-vue' })
    );
  });

  it('uses the selected Vue runtime when downloading staged translations', async () => {
    await handleDownload(
      options,
      settings({ stageTranslations: true }),
      'gt-vue'
    );

    expect(collectFiles).not.toHaveBeenCalled();
    expect(runDownloadWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ inlineLibrary: 'gt-vue' })
    );
  });
});

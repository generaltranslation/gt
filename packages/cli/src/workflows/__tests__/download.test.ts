import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobResult } from '@generaltranslation/api';
import type { Settings } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import { displayTranslateSummary } from '../../console/displayTranslateSummary.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';
import { TEMPLATE_FILE_NAME } from '../../utils/constants.js';
import { clearLocaleDirs } from '../../fs/clearLocaleDirs.js';
import { downloadFileBatch } from '../../api/downloadFileBatch.js';
import { runDownloadWorkflow } from '../download.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    createProgressBar: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      advance: vi.fn(),
    })),
  },
}));

vi.mock('../../fs/clearLocaleDirs.js', () => ({
  clearLocaleDirs: vi.fn(),
}));

const api = vi.hoisted(() => ({
  queryFiles: vi.fn(),
  awaitJobs: vi.fn(),
}));
vi.mock('../../utils/api.js', () => ({
  requireProject: () => api,
  resolveCanonicalLocale: (locale: string) => locale,
}));

vi.mock('../../api/downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

describe('runDownloadWorkflow', () => {
  const settings = {
    config: '/project/gt.config.json',
    options: {
      experimentalClearLocaleDirs: true,
    },
  } as Settings;

  const branchData = {
    currentBranch: { id: 'branch-1', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  const fileVersionData = {
    'file-1': {
      versionId: 'version-1',
      fileName: 'messages/en.json',
    },
  };

  const jobData = {
    jobData: {},
    locales: ['es'],
    message: 'No files need to be enqueued',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
    vi.mocked(downloadFileBatch).mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
    });
  });

  it('does not clear locale dirs when no translations are completed', async () => {
    vi.mocked(api.queryFiles).mockResolvedValue({
      results: [{ status: 'pending', fileId: 'file-1', locale: 'es' }],
    });

    await runDownloadWorkflow({
      fileVersionData,
      jobData,
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
    });

    expect(clearLocaleDirs).not.toHaveBeenCalled();
    expect(downloadFileBatch).not.toHaveBeenCalled();
  });

  it('clears locale dirs only after translations are confirmed completed', async () => {
    vi.mocked(api.queryFiles).mockResolvedValue({
      results: [
        {
          status: 'found',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'es',
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await runDownloadWorkflow({
      fileVersionData,
      jobData,
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
      inlineLibrary: 'gt-vue',
    });

    expect(clearLocaleDirs).toHaveBeenCalledTimes(1);
    const [translatedFiles, locales, exclude, cwd] =
      vi.mocked(clearLocaleDirs).mock.calls[0];
    expect([...translatedFiles]).toEqual(['messages/es.json']);
    expect(locales).toEqual(['es']);
    expect(exclude).toBeUndefined();
    expect(cwd).toBe('/project');
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    const [, , downloadSettings, , inlineLibrary] =
      vi.mocked(downloadFileBatch).mock.calls[0];
    expect(downloadSettings).toEqual(
      expect.objectContaining({ _branchId: 'branch-1' })
    );
    expect(downloadSettings).not.toBe(settings);
    expect(settings._branchId).toBeUndefined();
    expect(inlineLibrary).toBe('gt-vue');
  });

  const billingError =
    "Your account's credit balance is insufficient to complete this request. " +
    'Please add more usage credits to your account or configure auto-reload to reload your balance.\n' +
    '  Available: $5.99\n  Estimated: $27.86';

  function enqueueLocales(locales: string[]) {
    return {
      jobData: Object.fromEntries(
        locales.map((locale) => [
          `job-${locale}`,
          {
            sourceFileId: 'source-1',
            fileId: 'file-1',
            versionId: 'version-1',
            branchId: 'branch-1',
            targetLocale: locale,
            projectId: 'project-1',
            force: false,
          },
        ])
      ),
      locales,
      message: 'enqueued',
    };
  }

  it.each(['poll', 'final'] as const)(
    'shows the billing error from %s job statuses in both error output and the summary',
    async (delivery) => {
      const jobs = [
        { id: 'job-nb', status: 'failed', error: billingError },
      ] satisfies JobResult[];
      vi.mocked(api.awaitJobs).mockImplementation(async (_jobIds, options) => {
        if (delivery === 'poll') options?.onPoll?.(jobs);
        return { complete: true, jobs };
      });

      const result = await runDownloadWorkflow({
        fileVersionData: {
          'file-1': { versionId: 'version-1', fileName: TEMPLATE_FILE_NAME },
        },
        jobData: enqueueLocales(['nb']),
        branchData,
        locales: ['nb'],
        timeoutDuration: 1,
        resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
        options: settings,
        forceRetranslation: true,
      });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(billingError)
      );
      expect(getWarnings()).toEqual([
        {
          category: 'failed_translation',
          fileName: '<React Elements>',
          reason: expect.stringContaining(
            `Failed to translate for locale nb. Details: ${billingError}`
          ),
        },
      ]);
      displayTranslateSummary();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(billingError)
      );
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining(TEMPLATE_FILE_NAME)
      );
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining(TEMPLATE_FILE_NAME)
      );
      expect(clearLocaleDirs).not.toHaveBeenCalled();
      expect(downloadFileBatch).not.toHaveBeenCalled();
    }
  );

  it.each([null, '', '   '])(
    'reports the locale and file when the server reason is %j',
    async (message) => {
      vi.mocked(api.awaitJobs).mockImplementation(async (_jobIds, options) => {
        options?.onPoll?.([{ id: 'job-nb', status: 'failed', error: message }]);
        return {
          complete: true,
          jobs: [{ id: 'job-nb', status: 'failed' }],
        };
      });

      await runDownloadWorkflow({
        fileVersionData,
        jobData: enqueueLocales(['nb']),
        branchData,
        locales: ['nb'],
        timeoutDuration: 1,
        resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
        options: settings,
        forceRetranslation: true,
      });

      expect(getWarnings()).toEqual([
        {
          category: 'failed_translation',
          fileName: 'messages/en.json',
          reason: 'Failed to translate for locale nb.',
        },
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'messages/en.json: Failed to translate for locale nb.'
        )
      );
    }
  );

  it('keeps the failure reason while downloading only successful locales', async () => {
    const jobs = [
      { id: 'job-nb', status: 'failed', error: billingError },
      { id: 'job-fr', status: 'completed' },
    ] satisfies JobResult[];
    vi.mocked(api.awaitJobs).mockImplementation(async (_jobIds, options) => {
      options?.onPoll?.(jobs);
      return { complete: true, jobs };
    });
    vi.mocked(api.queryFiles).mockResolvedValue({
      results: [
        {
          status: 'found',
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'fr',
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await runDownloadWorkflow({
      fileVersionData: {
        'file-1': { versionId: 'version-1', fileName: TEMPLATE_FILE_NAME },
      },
      jobData: enqueueLocales(['fr', 'nb']),
      branchData,
      locales: ['fr', 'nb'],
      timeoutDuration: 1,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
      inlineLibrary: 'gt-vue',
      forceRetranslation: true,
    });

    expect(getWarnings()).toEqual([
      {
        category: 'failed_translation',
        fileName: '<Vue Elements>',
        reason: expect.stringContaining(billingError),
      },
    ]);
    expect(api.queryFiles).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        locale: 'fr',
      }),
    ]);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    expect([...vi.mocked(clearLocaleDirs).mock.calls[0][0]]).toEqual([
      'messages/fr.json',
    ]);
  });
});

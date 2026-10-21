import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGtApiAdapter } from 'generaltranslation/internal';
import type { Settings } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import { clearLocaleDirs } from '../../fs/clearLocaleDirs.js';
import { api } from '../../utils/api.js';
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

vi.mock('../../utils/api.js', () => ({
  api: {
    queryFileData: vi.fn(),
    resolveAliasLocale: vi.fn((locale: string) => locale),
  },
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

  const completedTranslation = {
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    locale: 'es',
    completedAt: '2026-01-01T00:00:00.000Z',
  };

  const runStagedDownload = (timeoutDuration: number) =>
    runDownloadWorkflow({
      fileVersionData,
      jobData: undefined,
      branchData,
      locales: ['es'],
      timeoutDuration,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
    });

  // Two staged pages whose translations share the docs/es directory
  const runStagedPagesDownload = (timeoutDuration: number) =>
    runDownloadWorkflow({
      fileVersionData: {
        'file-1': { versionId: 'version-1', fileName: 'docs/a.mdx' },
        'file-2': { versionId: 'version-2', fileName: 'docs/b.mdx' },
      },
      jobData: undefined,
      branchData,
      locales: ['es'],
      timeoutDuration,
      resolveOutputPath: (sourcePath, locale) =>
        sourcePath.replace('docs/', `docs/${locale}/`),
      options: settings,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(downloadFileBatch).mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not clear locale dirs when no translations are completed', async () => {
    vi.mocked(api.queryFileData).mockResolvedValue({
      translatedFiles: [],
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
    vi.mocked(api.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
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

  it('waits for staged files to finish before downloading them', async () => {
    vi.useFakeTimers();
    vi.mocked(api.queryFileData)
      .mockResolvedValueOnce({ translatedFiles: [] })
      .mockResolvedValue({ translatedFiles: [completedTranslation] });

    const download = runStagedDownload(60);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(download).resolves.toBe(true);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
  });

  it('reports staged files that are still processing at the timeout', async () => {
    vi.useFakeTimers();
    vi.mocked(api.queryFileData).mockResolvedValue({ translatedFiles: [] });

    const download = runStagedDownload(10);
    await vi.advanceTimersByTimeAsync(10000);

    await expect(download).resolves.toBe(false);
    // Checks at 0 and 5 seconds; none starts at the deadline
    expect(api.queryFileData).toHaveBeenCalledTimes(2);
    expect(downloadFileBatch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('1 file(s) are still processing')
    );
  });

  it('checks staged files once with a zero timeout', async () => {
    vi.mocked(api.queryFileData).mockResolvedValue({ translatedFiles: [] });

    await expect(runStagedDownload(0)).resolves.toBe(false);
    expect(api.queryFileData).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'gets no response',
      (request: Request) =>
        new Promise<Response>((_resolve, reject) =>
          request.signal.addEventListener('abort', () =>
            reject(request.signal.reason)
          )
        ),
    ],
    [
      'is rate limited',
      async () => new Response('Too many requests', { status: 429 }),
    ],
    [
      // Headers now, and the body ends 5 seconds later unless fetch's signal
      // aborts first, which fails the body read as fetch does
      'stalls its body',
      async (request: Request) =>
        new Response(
          new ReadableStream({
            start(body) {
              const timer = setTimeout(() => body.close(), 5000);
              request.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                body.error(request.signal.reason);
              });
            },
          }),
          { headers: { 'content-type': 'application/json' } }
        ),
    ],
  ])(
    'downloads completed staged files when a status check %s at the timeout',
    async (_case, answerCheck) => {
      vi.useFakeTimers();
      const completed = async () =>
        Response.json({
          translatedFiles: [completedTranslation],
          sourceFiles: [],
        });
      const answers = [completed, answerCheck, completed];
      const fetch = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) =>
          answers.shift()!(new Request(input, init))
      );
      // The real adapter and transport, with their timeouts and retries
      const adapter = createGtApiAdapter({
        baseUrl: 'https://api.test',
        fetch,
      });
      vi.mocked(api.queryFileData).mockImplementation(adapter.queryFileData);

      const startedAt = Date.now();
      const download = runStagedPagesDownload(7);
      await vi.runAllTimersAsync();

      await expect(download).resolves.toBe(false);
      expect(Date.now() - startedAt).toBe(7000);
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    }
  );

  it('passes staged files still processing to locale dir clearing', async () => {
    vi.useFakeTimers();
    vi.mocked(api.queryFileData).mockResolvedValue({
      translatedFiles: [completedTranslation],
    });

    const download = runStagedPagesDownload(5);
    await vi.runAllTimersAsync();

    await expect(download).resolves.toBe(false);
    const [translatedFiles, , , , pendingFiles] =
      vi.mocked(clearLocaleDirs).mock.calls[0];
    expect([...translatedFiles]).toEqual(['docs/es/a.mdx']);
    expect([...(pendingFiles ?? [])]).toEqual(['docs/es/b.mdx']);
  });
});

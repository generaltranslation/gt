import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, overrideConfig, pluginConfig } from '../../adapter/core';
import type { Secrets } from '../../types';
import { initProject } from '../initProject';

vi.mock('../../adapter/core', () => ({
  api: {
    generateProjectContext: vi.fn(),
    awaitJobs: vi.fn(),
  },
  overrideConfig: vi.fn(),
  pluginConfig: {
    getLocales: vi.fn(),
  },
}));

const uploadedFile = {
  branchId: 'branch-id',
  fileId: 'file-id',
  versionId: 'version-id',
  fileName: 'sanity/file-id',
  fileFormat: 'HTML',
  status: 'succeeded',
} as const;

const uploadResult = {
  summary: { total: 2, succeeded: 1, failed: 1 },
  results: [
    uploadedFile,
    {
      ...uploadedFile,
      fileId: 'failed-file-id',
      status: 'failed',
      error: 'not saved',
    },
  ],
} as Parameters<typeof initProject>[0];

const setupJob = {
  id: 'setup-job',
  status: 'queued',
  subject: { type: 'project_context', projectId: 'project-id' },
} as unknown as NonNullable<
  Awaited<ReturnType<typeof api.generateProjectContext>>['job']
>;

const secrets: Secrets = {
  organization: 'organization-id',
  project: 'project-id',
};

const consoleLog = vi.fn();

async function runWithAwaitResult(
  awaitResult: Awaited<ReturnType<typeof api.awaitJobs>>
) {
  vi.mocked(api.generateProjectContext).mockResolvedValue({ job: setupJob });
  vi.mocked(api.awaitJobs).mockResolvedValue(awaitResult);

  return initProject(uploadResult, { timeout: 30 }, secrets);
}

describe('initProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pluginConfig.getLocales).mockReturnValue(['es']);
    vi.spyOn(console, 'log').mockImplementation(consoleLog);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports completed setup jobs', async () => {
    await runWithAwaitResult({
      complete: true,
      jobs: [{ id: 'setup-job', status: 'completed' }],
    });

    expect(consoleLog).toHaveBeenCalledWith('Setup successfully completed');
    expect(overrideConfig).toHaveBeenCalledWith(secrets);
    expect(api.awaitJobs).toHaveBeenCalledWith(['setup-job'], {
      pollingIntervalSeconds: 2,
      timeoutSeconds: 30,
    });
  });

  it('generates context for uploaded files only', async () => {
    await runWithAwaitResult({
      complete: true,
      jobs: [{ id: 'setup-job', status: 'completed' }],
    });

    expect(api.generateProjectContext).toHaveBeenCalledWith([uploadedFile], {
      locales: ['es'],
    });
  });

  it('does not poll when the project context is already current', async () => {
    vi.mocked(api.generateProjectContext).mockResolvedValue({ job: null });

    await expect(initProject(uploadResult, {}, secrets)).resolves.toBe(true);

    expect(api.awaitJobs).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('reports failed setup jobs', async () => {
    await runWithAwaitResult({
      complete: true,
      jobs: [
        {
          id: 'setup-job',
          status: 'failed',
          error: 'Setup failed',
        },
      ],
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Setup failed — proceeding without setup (Setup failed)'
    );
  });

  it('reports missing setup jobs without calling them failed', async () => {
    await runWithAwaitResult({
      complete: true,
      jobs: [{ id: 'setup-job', status: 'not_found' }],
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Setup status unknown — proceeding without setup'
    );
  });

  it('reports setup polling timeouts', async () => {
    await runWithAwaitResult({
      complete: false,
      jobs: [{ id: 'setup-job', status: 'processing' }],
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Setup timed out — proceeding without setup (Timed out while waiting for setup generation)'
    );
  });
});

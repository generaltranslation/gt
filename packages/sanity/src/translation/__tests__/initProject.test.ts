import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gt, overrideConfig, pluginConfig } from '../../adapter/core';
import type { Secrets } from '../../types';
import { initProject } from '../initProject';

vi.mock('../../adapter/core', () => ({
  gt: {
    setupProject: vi.fn(),
    awaitJobs: vi.fn(),
  },
  overrideConfig: vi.fn(),
  pluginConfig: {
    getLocales: vi.fn(),
  },
}));

const uploadResult = {
  uploadedFiles: [
    {
      branchId: 'branch-id',
      fileId: 'file-id',
      versionId: 'version-id',
    },
  ],
} as Parameters<typeof initProject>[0];

const secrets: Secrets = {
  organization: 'organization-id',
  project: 'project-id',
};

const consoleLog = vi.fn();

async function runWithAwaitResult(
  awaitResult: Awaited<ReturnType<typeof gt.awaitJobs>>
) {
  vi.mocked(gt.setupProject).mockResolvedValue({
    status: 'queued',
    setupJobId: 'setup-job',
  });
  vi.mocked(gt.awaitJobs).mockResolvedValue(awaitResult);

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
      jobs: [{ jobId: 'setup-job', status: 'completed' }],
    });

    expect(consoleLog).toHaveBeenCalledWith('Setup successfully completed');
    expect(overrideConfig).toHaveBeenCalledWith(secrets);
    expect(gt.awaitJobs).toHaveBeenCalledWith(['setup-job'], {
      pollingIntervalSeconds: 2,
      timeoutSeconds: 30,
    });
  });

  it('reports failed setup jobs', async () => {
    await runWithAwaitResult({
      complete: true,
      jobs: [
        {
          jobId: 'setup-job',
          status: 'failed',
          error: { message: 'Setup failed' },
        },
      ],
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Setup failed — proceeding without setup (Setup failed)'
    );
  });

  it('reports unknown setup jobs without calling them failed', async () => {
    await runWithAwaitResult({
      complete: true,
      jobs: [{ jobId: 'setup-job', status: 'unknown' }],
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Setup status unknown — proceeding without setup'
    );
  });

  it('reports setup polling timeouts', async () => {
    await runWithAwaitResult({
      complete: false,
      jobs: [{ jobId: 'setup-job', status: 'processing' }],
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Setup timed out — proceeding without setup (Timed out while waiting for setup generation)'
    );
  });
});

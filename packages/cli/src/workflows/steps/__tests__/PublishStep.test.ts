import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectHandle } from 'generaltranslation';
import { logger } from '../../../console/logger.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';
import { PublishStep } from '../PublishStep.js';

const spinner = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));

vi.mock('../../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    createSpinner: vi.fn(() => spinner),
  },
}));

const entry = (name: string) => ({
  fileId: `id:${name}`,
  versionId: 'version-1',
  branchId: 'branch-1',
  publish: true,
  fileName: name,
});

describe('PublishStep', () => {
  const publishFiles = vi.fn<ProjectHandle['publishFiles']>();
  const api = { publishFiles } as unknown as ProjectHandle;

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
  });

  it('reports each failed version and translation and keeps going', async () => {
    const files = [entry('a.json'), entry('b.json'), entry('c.json')];
    const version = (name: string) => ({
      branchId: 'branch-1',
      fileId: `id:${name}`,
      versionId: 'version-1',
    });
    publishFiles.mockResolvedValue({
      summary: { total: 3, succeeded: 1, failed: 2 },
      results: [
        {
          ...version('a.json'),
          status: 'succeeded',
          translations: [{ locale: 'es', status: 'succeeded' }],
        },
        {
          ...version('b.json'),
          status: 'failed',
          error: 'one translation failed',
          translations: [
            { locale: 'es', status: 'succeeded' },
            { locale: 'fr', status: 'failed', error: 'CDN write failed' },
          ],
        },
        {
          ...version('c.json'),
          status: 'failed',
          error: 'version not found',
          translations: [],
        },
      ],
    });

    await expect(new PublishStep(api).run(files)).resolves.toBe(true);

    expect(publishFiles).toHaveBeenCalledWith(files);
    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('CDN updated with errors')
    );
    expect(getWarnings()).toEqual([
      {
        category: 'failed_publish',
        fileName: 'b.json',
        reason: 'Locale fr: CDN write failed',
      },
      {
        category: 'failed_publish',
        fileName: 'c.json',
        reason: 'version not found',
      },
    ]);
    expect(vi.mocked(logger.warn).mock.calls).toEqual([
      ['Failed to update b.json: Locale fr: CDN write failed'],
      ['Failed to update c.json: version not found'],
    ]);
  });

  it('reports success when every version publishes', async () => {
    publishFiles.mockResolvedValue({
      summary: { total: 1, succeeded: 1, failed: 0 },
      results: [
        {
          branchId: 'branch-1',
          fileId: 'id:a.json',
          versionId: 'version-1',
          status: 'succeeded',
          translations: [],
        },
      ],
    });

    await expect(new PublishStep(api).run([entry('a.json')])).resolves.toBe(
      true
    );

    expect(spinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('CDN updated')
    );
    expect(getWarnings()).toEqual([]);
  });

  it('returns false when the publish request fails', async () => {
    publishFiles.mockRejectedValue(new Error('CDN must be enabled'));

    await expect(new PublishStep(api).run([entry('a.json')])).resolves.toBe(
      false
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'Publish error: CDN must be enabled'
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCode } from 'generaltranslation/api';
import type { Secrets } from '../../types';

const queryFiles = vi.fn();

vi.mock('../../adapter/core', () => ({
  projectFor: () => ({ queryFiles }),
}));

const { checkTranslationStatus } = await import('../checkTranslationStatus');

const secrets = {} as Secrets;
const file = {
  branchId: 'branch-1',
  fileId: 'doc-1',
  versionId: 'v1',
  locale: 'fr',
};
const forbidden = new ApiError(
  'Missing permission',
  403,
  ErrorCode.PERMISSION_MISSING
);
const unavailable = new ApiError('Unavailable', 503, ErrorCode.UNAVAILABLE);

describe('checkTranslationStatus', () => {
  const downloadStatus = {
    downloaded: new Set<string>(),
    failed: new Set<string>(),
    skipped: new Set<string>(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('surfaces a permanent failure', async () => {
    queryFiles.mockRejectedValue(forbidden);

    await expect(
      checkTranslationStatus([file], downloadStatus, secrets)
    ).rejects.toBe(forbidden);
  });

  it('reports nothing ready after a transient failure', async () => {
    queryFiles.mockRejectedValue(unavailable);

    await expect(
      checkTranslationStatus([file], downloadStatus, secrets)
    ).resolves.toEqual([]);
  });
});

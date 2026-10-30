import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCode } from '@generaltranslation/api';
import type { Secrets } from '../../types';

const queryFilesContent = vi.fn();

vi.mock('../../adapter/core', () => ({
  projectFor: () => ({ queryFilesContent }),
}));

const { downloadTranslations } = await import('../downloadTranslations');

const secrets = {} as Secrets;
const file = {
  branchId: 'branch-1',
  fileId: 'doc-1',
  versionId: 'v1',
  locale: 'fr',
};
const ready = {
  status: 'ready',
  ...file,
  data: '{}',
};
const forbidden = new ApiError(
  'Missing permission',
  403,
  ErrorCode.PERMISSION_MISSING
);
const unavailable = new ApiError('Unavailable', 503, ErrorCode.UNAVAILABLE);

describe('downloadTranslations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retries a transient failure', async () => {
    queryFilesContent
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValueOnce({ results: [ready] });

    await expect(downloadTranslations([file], secrets, 3, 0)).resolves.toEqual([
      ready,
    ]);
    expect(queryFilesContent).toHaveBeenCalledTimes(2);
  });

  it('surfaces a permanent failure without retrying', async () => {
    queryFilesContent.mockRejectedValue(forbidden);

    await expect(downloadTranslations([file], secrets, 3, 0)).rejects.toBe(
      forbidden
    );
    expect(queryFilesContent).toHaveBeenCalledTimes(1);
  });

  it('surfaces the last transient failure once retries run out', async () => {
    queryFilesContent.mockRejectedValue(unavailable);

    await expect(downloadTranslations([file], secrets, 2, 0)).rejects.toBe(
      unavailable
    );
    expect(queryFilesContent).toHaveBeenCalledTimes(3);
  });
});

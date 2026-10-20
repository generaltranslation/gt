import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../../utils/api.js';
import type { Settings } from '../../../types/index.js';
import { TagStep } from '../TagStep.js';

vi.mock('../../../console/logger.js', () => ({
  logger: { createSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })) },
}));

describe('TagStep', () => {
  it('sets the tag to exactly the given file versions', async () => {
    const response = {
      created: false,
      tag: {
        id: 'tag-1',
        tagId: 'release',
        message: 'Release',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    };
    const setTag = vi.fn(async () => response);
    const step = new TagStep(
      { setTag } as unknown as ApiClient,
      { tag: 'release', tagMessage: 'Release' } as Settings,
      true
    );

    const result = await step.run([
      {
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        fileName: 'messages.json',
        fileFormat: 'JSON',
      },
    ]);

    expect(setTag).toHaveBeenCalledWith('release', {
      files: [
        { fileId: 'file-1', versionId: 'version-1', branchId: 'branch-1' },
      ],
      message: 'Release',
    });
    expect(result).toBe(response);
  });
});

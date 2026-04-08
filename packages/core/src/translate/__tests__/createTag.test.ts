import { describe, it, expect, vi, beforeEach } from 'vitest';
import _createTag, {
  CreateTagOptions,
  CreateTagResult,
  CreateTagFileReference,
} from '../createTag';
import { TranslationRequestConfig } from '../../types';
import apiRequest from '../utils/apiRequest';

vi.mock('../utils/apiRequest');

describe('_createTag', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const createMockFile = (
    overrides: Partial<CreateTagFileReference> = {}
  ): CreateTagFileReference => ({
    fileId: 'file-123',
    versionId: 'version-456',
    branchId: 'branch-123',
    ...overrides,
  });

  const mockTagResult: CreateTagResult = {
    tag: {
      id: 'tag-internal-id',
      tagId: 'v1.0.0',
      message: 'initial release',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a tag with tagId, files, and message', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTagResult);

    const options: CreateTagOptions = {
      tagId: 'v1.0.0',
      files: [createMockFile(), createMockFile({ fileId: 'file-456' })],
      message: 'initial release',
    };

    const result = await _createTag(options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/tags/create',
      {
        body: {
          tagId: 'v1.0.0',
          files: [
            {
              fileId: 'file-123',
              versionId: 'version-456',
              branchId: 'branch-123',
            },
            {
              fileId: 'file-456',
              versionId: 'version-456',
              branchId: 'branch-123',
            },
          ],
          message: 'initial release',
        },
      }
    );
    expect(result).toEqual(mockTagResult);
  });

  it('should omit message from body when not provided', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      tag: { ...mockTagResult.tag, message: null },
    });

    const options: CreateTagOptions = {
      tagId: 'v2.0.0',
      files: [createMockFile()],
    };

    await _createTag(options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/tags/create',
      {
        body: {
          tagId: 'v2.0.0',
          files: [
            {
              fileId: 'file-123',
              versionId: 'version-456',
              branchId: 'branch-123',
            },
          ],
        },
      }
    );
  });

  it('should propagate API errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('API error'));

    const options: CreateTagOptions = {
      tagId: 'v1.0.0',
      files: [createMockFile()],
      message: 'test',
    };

    await expect(_createTag(options, mockConfig)).rejects.toThrow('API error');
  });

  it('should call the correct endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTagResult);

    await _createTag({ tagId: 'test', files: [createMockFile()] }, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/tags/create',
      expect.any(Object)
    );
  });
});

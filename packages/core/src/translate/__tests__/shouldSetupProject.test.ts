import { describe, it, expect, vi, beforeEach } from 'vitest';
import _shouldSetupProject, {
  ShouldSetupProjectResult,
} from '../shouldSetupProject';
import { TranslationRequestConfig } from '../../types';
import validateResponse from '../utils/validateResponse';
import generateRequestHeaders from '../utils/generateRequestHeaders';

vi.mock('../utils/validateResponse');
vi.mock('../utils/generateRequestHeaders');

const mockFetch = vi.fn();

describe('_shouldSetupProject', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.mocked(validateResponse).mockReset();
    vi.mocked(generateRequestHeaders).mockReset();
    
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
    global.fetch = mockFetch;
  });



  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    mockFetch.mockRejectedValue(fetchError);

    await expect(_shouldSetupProject(mockConfig)).rejects.toThrow(
      'Network error'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/setup/should-generate',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      }
    );
  });

  it('should use correct request headers', async () => {
    const mockResponse: ShouldSetupProjectResult = {
      shouldSetupProject: true,
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    mockFetch.mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _shouldSetupProject(mockConfig);

    expect(generateRequestHeaders).toHaveBeenCalledWith(mockConfig, true);
    expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-gt-api-key': 'test-api-key',
        'x-gt-project-id': 'test-project',
      },
    });
  });

  it('should handle different response structures', async () => {
    const mockResponse: ShouldSetupProjectResult = {
      shouldSetupProject: true,
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    mockFetch.mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _shouldSetupProject(mockConfig);

    expect(typeof result.shouldSetupProject).toBe('boolean');
    expect(result).toHaveProperty('shouldSetupProject');
  });
});

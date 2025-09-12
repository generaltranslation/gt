import { describe, it, expect, vi, beforeEach } from 'vitest';
import _shouldSetupProject, { ShouldSetupProjectResult } from '../shouldSetupProject';
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
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
    global.fetch = mockFetch;
  });

  it('should check if setup is needed', async () => {
    const mockResponse: ShouldSetupProjectResult = {
      shouldSetupProject: true,
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    mockFetch.mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _shouldSetupProject(mockConfig);

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

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
    expect(result).toEqual(mockResponse);
    expect(result.shouldSetupProject).toBe(true);
  });

  it('should return false when setup is not needed', async () => {
    const mockResponse: ShouldSetupProjectResult = {
      shouldSetupProject: false,
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    mockFetch.mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _shouldSetupProject(mockConfig);

    expect(result.shouldSetupProject).toBe(false);
  });

  it('should use default base URL when not provided', async () => {
    const configWithoutBaseUrl = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const mockResponse: ShouldSetupProjectResult = {
      shouldSetupProject: true,
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    mockFetch.mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _shouldSetupProject(configWithoutBaseUrl);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api2.gtx.dev/v2/project/setup/should-generate'),
      expect.any(Object)
    );
  });

  it('should handle validation errors', async () => {
    const mockFetchResponse = {
      json: vi.fn(),
    } as unknown as Response;

    const validationError = new Error('Invalid response');
    mockFetch.mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockRejectedValue(validationError);

    await expect(_shouldSetupProject(mockConfig)).rejects.toThrow('Invalid response');

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    mockFetch.mockRejectedValue(fetchError);

    await expect(_shouldSetupProject(mockConfig)).rejects.toThrow('Network error');

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
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
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
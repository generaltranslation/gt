import { describe, it, expect, vi, beforeEach } from 'vitest';
import _getProjectData from '../getProjectData';
import fetchWithTimeout from '../../translate/utils/fetchWithTimeout';
import validateResponse from '../../translate/utils/validateResponse';
import handleFetchError from '../../translate/utils/handleFetchError';
import generateRequestHeaders from '../../translate/utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import { ProjectData } from '../../types-dir/project';

vi.mock('../../translate/utils/fetchWithTimeout');
vi.mock('../../translate/utils/validateResponse');
vi.mock('../../translate/utils/handleFetchError');
vi.mock('../../translate/utils/generateRequestHeaders');

describe.sequential('_getProjectData', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockProjectData: ProjectData = {
    id: 'test-project-123',
    name: 'Test Project',
    orgId: 'test-org-456',
    defaultLocale: 'en',
    currentLocales: ['en', 'es', 'fr', 'de'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should get project data successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {
      timeout: 5000,
    };

    const result = await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/info/test-project-123',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockProjectData);
  });

  it('should use config baseUrl when provided', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {};

    await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/info/test-project-123',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const projectId = 'test-project-123';
    const options = {};

    await _getProjectData(projectId, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v2/project/info/test-project-123'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {};

    await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {
      timeout: 99999,
    };

    await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should handle fetch errors through handleFetchError', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    const projectId = 'test-project-123';
    const options = {};

    await expect(
      _getProjectData(projectId, options, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const projectId = 'test-project-123';
    const options = {};

    await expect(
      _getProjectData(projectId, options, mockConfig)
    ).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should properly encode projectId in URL', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'project with spaces & special chars';
    const options = {};

    const result = await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/info/project%20with%20spaces%20%26%20special%20chars',
      expect.objectContaining({
        method: 'GET',
      }),
      expect.any(Number)
    );
    expect(result).toEqual(mockProjectData);
  });

  it('should use correct HTTP method and headers', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {};

    await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      },
      expect.any(Number)
    );
  });

  it('should call generateRequestHeaders with correct parameters', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {
      timeout: 8000,
    };

    await _getProjectData(projectId, options, mockConfig);

    expect(generateRequestHeaders).toHaveBeenCalledWith(mockConfig, true);
  });

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {};

    await expect(
      _getProjectData(projectId, options, mockConfig)
    ).rejects.toThrow('Invalid JSON');
  });

  it('should handle empty projectId', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = '';
    const options = {};

    await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/info/',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should return correct project data structure', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'test-project-123';
    const options = {};

    const result = await _getProjectData(projectId, options, mockConfig);

    expect(result).toEqual({
      id: 'test-project-123',
      name: 'Test Project',
      orgId: 'test-org-456',
      defaultLocale: 'en',
      currentLocales: ['en', 'es', 'fr', 'de'],
    });
    expect(result.id).toBe('test-project-123');
    expect(result.name).toBe('Test Project');
    expect(result.currentLocales).toBeInstanceOf(Array);
  });

  it('should handle special characters in projectId correctly', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockProjectData),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const projectId = 'project/with-dashes_and.dots';
    const options = {};

    await _getProjectData(projectId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/info/project%2Fwith-dashes_and.dots',
      expect.any(Object),
      expect.any(Number)
    );
  });
});

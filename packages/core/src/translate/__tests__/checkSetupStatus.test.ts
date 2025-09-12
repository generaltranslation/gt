import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  _checkSetupStatus,
  CheckSetupStatusResult,
  SetupJobStatus,
} from '../checkSetupStatus';
import { TranslationRequestConfig } from '../../types';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe('_checkSetupStatus', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWithTimeout).mockReset();
    vi.mocked(validateResponse).mockReset();
    vi.mocked(handleFetchError).mockReset();
    vi.mocked(generateRequestHeaders).mockReset();
    
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should check setup status successfully', async () => {
    const mockResponse: CheckSetupStatusResult = {
      jobId: 'job-123',
      status: 'completed',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _checkSetupStatus('job-123', mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/setup/status/job-123',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      },
      60000
    );

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
    expect(result).toEqual(mockResponse);
  });

  it('should check setup status with custom timeout', async () => {
    const mockResponse: CheckSetupStatusResult = {
      jobId: 'job-123',
      status: 'processing',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _checkSetupStatus('job-123', mockConfig, 30000);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      30000
    );

    expect(result).toEqual(mockResponse);
  });

  it('should handle queued status', async () => {
    const mockResponse: CheckSetupStatusResult = {
      jobId: 'job-123',
      status: 'queued',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _checkSetupStatus('job-123', mockConfig);

    expect(result.status).toBe('queued');
    expect(result.jobId).toBe('job-123');
  });

  it('should handle failed status with error message', async () => {
    const mockResponse: CheckSetupStatusResult = {
      jobId: 'job-123',
      status: 'failed',
      error: { message: 'Setup generation failed' },
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _checkSetupStatus('job-123', mockConfig);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('Setup generation failed');
  });

  it('should handle processing status', async () => {
    const mockResponse: CheckSetupStatusResult = {
      jobId: 'job-123',
      status: 'processing',
    };

    const mockFetchResponse = {
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _checkSetupStatus('job-123', mockConfig);

    expect(result.status).toBe('processing');
    expect(result.jobId).toBe('job-123');
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    await expect(_checkSetupStatus('job-123', mockConfig)).rejects.toThrow(
      'Network error'
    );

    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });


  it('should handle validation errors', async () => {
    const mockFetchResponse = {
      json: vi.fn(),
    } as unknown as Response;

    const validationError = new Error('Invalid response');
    vi.mocked(fetchWithTimeout).mockResolvedValue(mockFetchResponse);
    vi.mocked(validateResponse).mockRejectedValue(validationError);

    await expect(_checkSetupStatus('job-123', mockConfig)).rejects.toThrow(
      'Invalid response'
    );

    expect(validateResponse).toHaveBeenCalledWith(mockFetchResponse);
  });
});

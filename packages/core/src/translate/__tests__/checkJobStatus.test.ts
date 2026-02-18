import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationRequestConfig } from '../../types';
import apiRequest from '../utils/apiRequest';
import { _checkJobStatus, CheckJobStatusResult } from '../checkJobStatus';

vi.mock('../utils/apiRequest');

describe('_checkJobStatus', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check setup status successfully', async () => {
    const mockResponse: CheckJobStatusResult = [
      {
        jobId: 'job-123',
        status: 'completed',
        error: undefined,
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _checkJobStatus(['job-123'], mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/jobs/info',
      { body: { jobIds: ['job-123'] }, timeout: undefined }
    );
    expect(result).toEqual(mockResponse);
  });

  it('should check setup status with custom timeout', async () => {
    const mockResponse: CheckJobStatusResult = [
      {
        jobId: 'job-123',
        status: 'processing',
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _checkJobStatus(['job-123'], mockConfig, 30000);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/jobs/info',
      { body: { jobIds: ['job-123'] }, timeout: 30000 }
    );
    expect(result).toEqual(mockResponse);
  });

  it('should handle queued status', async () => {
    const mockResponse: CheckJobStatusResult = [
      {
        jobId: 'job-123',
        status: 'queued',
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _checkJobStatus(['job-123'], mockConfig);

    expect(result[0].status).toBe('queued');
    expect(result[0].jobId).toBe('job-123');
  });

  it('should handle failed status with error message', async () => {
    const mockResponse: CheckJobStatusResult = [
      {
        jobId: 'job-123',
        status: 'failed',
        error: { message: 'Setup generation failed' },
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _checkJobStatus(['job-123'], mockConfig);

    expect(result[0].status).toBe('failed');
    expect(result[0].error?.message).toBe('Setup generation failed');
  });

  it('should handle processing status', async () => {
    const mockResponse: CheckJobStatusResult = [
      {
        jobId: 'job-123',
        status: 'processing',
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await _checkJobStatus(['job-123'], mockConfig);

    expect(result[0].status).toBe('processing');
    expect(result[0].jobId).toBe('job-123');
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    await expect(_checkJobStatus(['job-123'], mockConfig)).rejects.toThrow(
      'Network error'
    );
  });

  it('should handle validation errors', async () => {
    const validationError = new Error('Invalid response');
    vi.mocked(apiRequest).mockRejectedValue(validationError);

    await expect(_checkJobStatus(['job-123'], mockConfig)).rejects.toThrow(
      'Invalid response'
    );
  });
});

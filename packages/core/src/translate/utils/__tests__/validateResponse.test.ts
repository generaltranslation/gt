import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../logging/errors', () => ({
  apiError: vi.fn(
    (status: number, statusText: string, error: string) =>
      `GT Error: API returned error status. Status: ${status}, Status Text: ${statusText}, Error: ${error}`
  ),
}));

import validateResponse from '../validateResponse';
import { apiError } from '../../../logging/errors';
import { ApiError } from '../../../errors/ApiError';

describe.sequential('validateResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass validation for successful response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response;

    await expect(validateResponse(mockResponse)).resolves.toBeUndefined();
    expect(apiError).not.toHaveBeenCalled();
  });

  it('should throw error for failed response with error text', async () => {
    const errorMsg = 'Invalid API key';

    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue({ error: errorMsg }),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(ApiError);
    await expect(validateResponse(mockResponse)).rejects.toThrow(errorMsg);
    expect(apiError).toHaveBeenCalledWith(401, 'Unauthorized', errorMsg);
  });

  it('should handle 404 not found errors', async () => {
    const errorMsg = 'Project not found';

    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockResolvedValue({ error: errorMsg }),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(ApiError);
    await expect(validateResponse(mockResponse)).rejects.toThrow(errorMsg);
    expect(apiError).toHaveBeenCalledWith(404, 'Not Found', errorMsg);
  });

  it('should handle 500 server errors', async () => {
    const errorMsg = 'Internal server error';

    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockResolvedValue({ error: errorMsg }),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(ApiError);
    await expect(validateResponse(mockResponse)).rejects.toThrow(errorMsg);
    expect(apiError).toHaveBeenCalledWith(
      500,
      'Internal Server Error',
      errorMsg
    );
  });

  it('should handle empty error text', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue({ error: '' }),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(ApiError);
    expect(apiError).toHaveBeenCalledWith(400, 'Bad Request', '');
  });

  it('should handle response.json() rejection', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi
        .fn()
        .mockRejectedValue(new Error('Failed to read response body')),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(
      'Failed to read response body'
    );
    expect(apiError).not.toHaveBeenCalled();
  });
});

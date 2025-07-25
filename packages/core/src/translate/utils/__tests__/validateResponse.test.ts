import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../logging/errors', () => ({
  apiError: vi.fn(
    (status: number, statusText: string, error: string) =>
      `GT error: API returned error status. Status: ${status}, Status Text: ${statusText}, Error: ${error}`
  ),
}));

vi.mock('../../../logging/logger', () => ({
  fetchLogger: {
    error: vi.fn(),
  },
}));

import validateResponse from '../validateResponse';
import { apiError } from '../../../logging/errors';
import { fetchLogger } from '../../../logging/logger';

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
    expect(fetchLogger.error).not.toHaveBeenCalled();
  });

  it('should throw error for failed response with error text', async () => {
    const errorText = 'Invalid API key';
    const expectedErrorMessage =
      'GT error: API returned error status. Status: 401, Status Text: Unauthorized, Error: Invalid API key';

    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(errorText);
    expect(mockResponse.text).toHaveBeenCalled();
    expect(apiError).toHaveBeenCalledWith(401, 'Unauthorized', errorText);
    expect(fetchLogger.error).toHaveBeenCalledWith(expectedErrorMessage, {
      status: 401,
      statusText: 'Unauthorized',
      error: errorText,
    });
  });

  it('should handle 404 not found errors', async () => {
    const errorText = 'Project not found';

    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(errorText);
    expect(apiError).toHaveBeenCalledWith(404, 'Not Found', errorText);
  });

  it('should handle 500 server errors', async () => {
    const errorText = 'Internal server error';

    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(errorText);
    expect(apiError).toHaveBeenCalledWith(
      500,
      'Internal Server Error',
      errorText
    );
  });

  it('should handle empty error text', async () => {
    const errorText = '';

    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(errorText);
    expect(apiError).toHaveBeenCalledWith(400, 'Bad Request', errorText);
  });

  it('should handle response.text() rejection', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi
        .fn()
        .mockRejectedValue(new Error('Failed to read response body')),
    } as unknown as Response;

    await expect(validateResponse(mockResponse)).rejects.toThrow(
      'Failed to read response body'
    );
    expect(apiError).not.toHaveBeenCalled();
    expect(fetchLogger.error).not.toHaveBeenCalled();
  });
});

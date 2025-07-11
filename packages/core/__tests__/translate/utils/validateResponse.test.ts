import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/logging/errors', () => ({
  apiError: vi.fn(() => 'mocked error'),
}));

vi.mock('../../../src/logging/logger', () => ({
  fetchLogger: {
    error: vi.fn(),
  },
}));

import validateResponse from '../../../src/translate/utils/validateResponse';
import { apiError } from '../../../src/logging/errors';
import { fetchLogger } from '../../../src/logging/logger';

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
      'API Error: 401 Unauthorized - Invalid API key';

    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    vi.mocked(apiError).mockReturnValueOnce(expectedErrorMessage);

    await expect(validateResponse(mockResponse)).rejects.toThrow(
      expectedErrorMessage
    );
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
    const expectedErrorMessage = 'API Error: 404 Not Found - Project not found';

    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    vi.mocked(apiError).mockReturnValueOnce(expectedErrorMessage);

    await expect(validateResponse(mockResponse)).rejects.toThrow(
      expectedErrorMessage
    );
    expect(apiError).toHaveBeenCalledWith(404, 'Not Found', errorText);
  });

  it('should handle 500 server errors', async () => {
    const errorText = 'Internal server error';
    const expectedErrorMessage =
      'API Error: 500 Internal Server Error - Internal server error';

    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    vi.mocked(apiError).mockReturnValueOnce(expectedErrorMessage);

    await expect(validateResponse(mockResponse)).rejects.toThrow(
      expectedErrorMessage
    );
    expect(apiError).toHaveBeenCalledWith(
      500,
      'Internal Server Error',
      errorText
    );
  });

  it('should handle empty error text', async () => {
    const errorText = '';
    const expectedErrorMessage = 'API Error: 400 Bad Request - ';

    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response;

    vi.mocked(apiError).mockReturnValueOnce(expectedErrorMessage);

    await expect(validateResponse(mockResponse)).rejects.toThrow(
      expectedErrorMessage
    );
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

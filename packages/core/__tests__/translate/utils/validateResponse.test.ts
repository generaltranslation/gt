import { describe, it, expect, vi, beforeEach } from 'vitest';
import validateResponse from '../../../src/translate/utils/validateResponse';

// Mock Response type for testing
interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}

// Mock the logger
vi.mock('../../../src/logging/logger', () => ({
  translationLogger: {
    error: vi.fn(),
  },
}));

describe('validateResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass validation with successful response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn(),
    } as MockResponse;

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateResponse(mockResponse as any)
    ).resolves.not.toThrow();
    expect(mockResponse.text).not.toHaveBeenCalled();
  });

  it('should throw error for 400 Bad Request', async () => {
    const errorText = 'Invalid request format';
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue(errorText),
    } as MockResponse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(validateResponse(mockResponse as any)).rejects.toThrow(
      'GT error: Translation API returned error status. Status: 400, Status Text: Bad Request, Error: Invalid request format'
    );
  });

  it('should throw error for 401 Unauthorized', async () => {
    const errorText = 'Invalid API key';
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue(errorText),
    } as MockResponse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(validateResponse(mockResponse as any)).rejects.toThrow(
      'GT error: Translation API returned error status. Status: 401, Status Text: Unauthorized, Error: Invalid API key'
    );
  });

  it('should throw error for 500 Internal Server Error', async () => {
    const errorText = 'Server error occurred';
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue(errorText),
    } as MockResponse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(validateResponse(mockResponse as any)).rejects.toThrow(
      'GT error: Translation API returned error status. Status: 500, Status Text: Internal Server Error, Error: Server error occurred'
    );
  });

  it('should handle empty error text', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue(''),
    } as MockResponse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(validateResponse(mockResponse as any)).rejects.toThrow(
      'GT error: Translation API returned error status. Status: 404, Status Text: Not Found, Error: '
    );
  });
});

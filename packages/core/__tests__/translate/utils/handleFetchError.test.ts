import { describe, it, expect, vi, beforeEach } from 'vitest';
import handleFetchError from '../../../src/translate/utils/handleFetchError';

// Mock the logger
vi.mock('../../../src/logging/logger', () => ({
  fetchLogger: {
    error: vi.fn(),
  },
}));

describe('handleFetchError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle AbortError (timeout)', () => {
    const abortError = new Error('Request timeout');
    abortError.name = 'AbortError';
    const timeout = 5000;

    expect(() => handleFetchError(abortError, timeout)).toThrow(
      'GT error: Translation request timed out after 5000ms. This has either occured due to the translation of an unusually large request or a translation failure in the API.'
    );
  });

  it('should handle generic network error', () => {
    const networkError = new Error('Network connection failed');
    const timeout = 5000;

    expect(() => handleFetchError(networkError, timeout)).toThrow(networkError);
  });

  it('should handle non-Error objects', () => {
    const stringError = 'String error message';
    const timeout = 5000;

    expect(() => handleFetchError(stringError, timeout)).toThrow(stringError);
  });

  it('should handle different timeout values', () => {
    const abortError = new Error('Request timeout');
    abortError.name = 'AbortError';
    const timeout = 10000;

    expect(() => handleFetchError(abortError, timeout)).toThrow(
      'GT error: Translation request timed out after 10000ms. This has either occured due to the translation of an unusually large request or a translation failure in the API.'
    );
  });

  it('should handle undefined error', () => {
    const undefinedError = undefined;
    const timeout = 5000;

    expect(() => handleFetchError(undefinedError, timeout)).toThrow();
  });

  it('should handle object error', () => {
    const objectError = { message: 'Object error', code: 500 };
    const timeout = 5000;

    expect(() => handleFetchError(objectError, timeout)).toThrow();
  });
});

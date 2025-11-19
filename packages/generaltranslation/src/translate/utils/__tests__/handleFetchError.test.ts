import { describe, it, expect, vi, beforeEach } from 'vitest';
import handleFetchError from '../handleFetchError';
import { fetchLogger } from '../../../logging/logger';
import {
  translationRequestFailedError,
  translationTimeoutError,
} from '../../../logging/errors';

vi.mock('../../../logging/logger', () => ({
  fetchLogger: {
    error: vi.fn(),
  },
}));

vi.mock('../../../logging/errors', () => ({
  translationRequestFailedError: vi.fn(),
  translationTimeoutError: vi.fn(),
}));

describe('handleFetchError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle AbortError as timeout error', () => {
    const timeout = 5000;
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';

    vi.mocked(translationTimeoutError).mockReturnValue('Timeout after 5000ms');

    expect(() => handleFetchError(abortError, timeout)).toThrow(
      'Timeout after 5000ms'
    );
    expect(translationTimeoutError).toHaveBeenCalledWith(timeout);
    expect(fetchLogger.error).toHaveBeenCalledWith('Timeout after 5000ms');
  });

  it('should handle regular Error objects', () => {
    const timeout = 5000;
    const error = new Error('Network error');

    vi.mocked(translationRequestFailedError).mockReturnValue(
      'Request failed: Network error'
    );

    expect(() => handleFetchError(error, timeout)).toThrow(error);
    expect(translationRequestFailedError).toHaveBeenCalledWith('Network error');
    expect(fetchLogger.error).toHaveBeenCalledWith(
      'Request failed: Network error'
    );
  });

  it('should handle non-Error objects', () => {
    const timeout = 5000;
    const error = 'String error';

    vi.mocked(translationRequestFailedError).mockReturnValue(
      'Request failed: String error'
    );

    expect(() => handleFetchError(error, timeout)).toThrow(error);
    expect(translationRequestFailedError).toHaveBeenCalledWith('String error');
    expect(fetchLogger.error).toHaveBeenCalledWith(
      'Request failed: String error'
    );
  });
});

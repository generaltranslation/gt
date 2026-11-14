import { describe, expect, it } from 'vitest';
import { ApiError, ErrorCode } from '@generaltranslation/api';
import { apiErrorCause } from '../apiErrorCause';

describe('apiErrorCause', () => {
  it.each([
    [ErrorCode.PAYMENT_REQUIRED, 'Billing'],
    [ErrorCode.USAGE_LIMIT_REACHED, 'monthly limit'],
    [ErrorCode.SPEND_LIMIT_REACHED, 'spend limit'],
    [ErrorCode.CREDITS_INSUFFICIENT, 'credit balance'],
    [ErrorCode.LOCALE_NOT_ALLOWED, 'locale is not enabled'],
    [ErrorCode.TARGET_LOCALES_MISSING, 'locale is not enabled'],
    [ErrorCode.PLAN_FEATURE_UNAVAILABLE, 'plan does not include'],
    [ErrorCode.PERMISSION_MISSING, 'lacks a required permission'],
    [ErrorCode.API_KEY_INVALID, 'not valid'],
  ])('adds the hint for %s to the API message', (code, hint) => {
    const text = apiErrorCause(
      new ApiError('Server message.', 400, code),
      'Try again.'
    );
    expect(text).toMatch(/^Server message\. /);
    expect(text).toContain(hint);
    expect(text).not.toMatch(/try again/i);
  });

  it.each([
    new ApiError('Server message.', 503, ErrorCode.UNAVAILABLE),
    new ApiError('Server message.', 403, 'some_future_code'),
    new ApiError('Server message.', 500),
  ])('adds the fallback to the API message of %s', (error) => {
    expect(apiErrorCause(error, 'Try again.')).toBe(
      'Server message. Try again.'
    );
  });

  it('ends an API message that has no closing punctuation', () => {
    expect(apiErrorCause(new ApiError('HTTP 502', 502), 'Try again.')).toBe(
      'HTTP 502. Try again.'
    );
  });

  it('gives only the fallback for a failure that is not from the API', () => {
    expect(apiErrorCause(new Error('socket hang up'), 'Try again.')).toBe(
      'Try again.'
    );
  });
});

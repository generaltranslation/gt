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
  ])('states the cause of %s without advising a retry', (code, cause) => {
    const text = apiErrorCause(new ApiError('message', 400, code));
    expect(text).toContain(cause);
    expect(text).not.toMatch(/try again/i);
  });

  it.each([
    new ApiError('m', 503, ErrorCode.UNAVAILABLE),
    new ApiError('m', 403, 'some_future_code'),
    new ApiError('m', 500),
    new Error('m'),
  ])('leaves %s to the retry advice', (error) => {
    expect(apiErrorCause(error)).toBeUndefined();
  });
});

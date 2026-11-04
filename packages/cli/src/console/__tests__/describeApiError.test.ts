import { describe, expect, it } from 'vitest';
import { ApiError, ErrorCode } from 'generaltranslation/api';
import { describeApiError, workflowFailureMessage } from '../index.js';
import { GT_DASHBOARD_URL } from '../../utils/constants.js';

describe('describeApiError', () => {
  it.each([
    [ErrorCode.PAYMENT_REQUIRED, 'manage billing'],
    [ErrorCode.USAGE_LIMIT_REACHED, 'manage billing'],
    [ErrorCode.SPEND_LIMIT_REACHED, 'manage billing'],
    [ErrorCode.CREDITS_INSUFFICIENT, 'manage billing'],
    [ErrorCode.UNAUTHENTICATED, 'GT_API_KEY'],
    [ErrorCode.API_KEY_INVALID, 'GT_API_KEY'],
    [ErrorCode.TOKEN_INVALID, '`gt login`'],
    [ErrorCode.SCOPE_MISSING, '`gt login`'],
    [ErrorCode.PERMISSION_MISSING, 'permission named in the error'],
    [ErrorCode.LOCALE_NOT_ALLOWED, 'enable the locales'],
    [ErrorCode.TARGET_LOCALES_MISSING, 'enable the locales'],
    [ErrorCode.PLAN_FEATURE_UNAVAILABLE, 'upgrade your plan'],
    [ErrorCode.PROJECT_LIMIT_REACHED, 'delete an unused project'],
    [ErrorCode.CDN_NOT_ENABLED, 'enable the CDN'],
    [ErrorCode.RATE_LIMITED, 'try again'],
  ])('gives a fix for %s', (code, fix) => {
    expect(describeApiError(new ApiError('message', 400, code))).toContain(fix);
  });

  it('links the dashboard for billing', () => {
    expect(
      describeApiError(new ApiError('m', 402, ErrorCode.CREDITS_INSUFFICIENT))
    ).toContain(GT_DASHBOARD_URL);
  });

  it.each([
    new ApiError('m', 500, ErrorCode.INTERNAL_ERROR),
    new ApiError('m', 403, 'some_future_code'),
    new ApiError('m', 403),
    new Error('m'),
    undefined,
  ])('has no fix for %s', (error) => {
    expect(describeApiError(error)).toBeUndefined();
  });
});

describe('workflowFailureMessage', () => {
  it('replaces the generic fix with the code fix and keeps the server message', () => {
    const message = workflowFailureMessage(
      'Files could not be uploaded.',
      new ApiError(
        'Locale xx is not enabled.',
        403,
        ErrorCode.LOCALE_NOT_ALLOWED
      )
    );

    expect(message).toContain(
      'Files could not be uploaded. Open the dashboard'
    );
    expect(message).not.toContain('Check the files');
    expect(message).toContain(
      'Original error: ApiError: Locale xx is not enabled.'
    );
  });

  it('keeps the generic fix for errors without one', () => {
    expect(
      workflowFailureMessage('Files could not be uploaded.', new Error('boom'))
    ).toBe(
      'Files could not be uploaded. Check the files, branch configuration, and API credentials, then try again. Original error: Error: boom'
    );
  });
});

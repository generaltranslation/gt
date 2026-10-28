import { ApiError, ErrorCode } from '@generaltranslation/api';

/** A short cause for an API failure that trying again will not fix; undefined for any other failure. */
export function apiErrorCause(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case ErrorCode.PAYMENT_REQUIRED:
      return 'Billing for your General Translation account needs attention in the dashboard.';
    case ErrorCode.USAGE_LIMIT_REACHED:
      return "Your General Translation plan's monthly limit is reached.";
    case ErrorCode.SPEND_LIMIT_REACHED:
      return 'Your General Translation spend limit is reached.';
    case ErrorCode.CREDITS_INSUFFICIENT:
      return 'Your General Translation credit balance is too low.';
    case ErrorCode.LOCALE_NOT_ALLOWED:
    case ErrorCode.TARGET_LOCALES_MISSING:
      return 'A locale is not enabled in the General Translation project settings.';
    case ErrorCode.PLAN_FEATURE_UNAVAILABLE:
      return 'Your General Translation plan does not include this feature.';
    case ErrorCode.PERMISSION_MISSING:
      return 'The General Translation API key lacks a required permission. Check the console for details.';
    case ErrorCode.UNAUTHENTICATED:
    case ErrorCode.API_KEY_INVALID:
      return 'The General Translation API key is not valid. Check the plugin secrets.';
    default:
      return undefined;
  }
}

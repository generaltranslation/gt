import { ApiError, ErrorCode } from '@generaltranslation/api';

/** The API's message for a failure, then a hint for a code that trying again will not fix, or `fallback`. */
export function apiErrorCause(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  // A response without a message falls back to its status text, which has no period.
  const message = /[.!?]$/.test(error.message)
    ? error.message
    : `${error.message}.`;
  return `${message} ${apiErrorHint(error.code) ?? fallback}`;
}

function apiErrorHint(code: ApiError['code']): string | undefined {
  switch (code) {
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

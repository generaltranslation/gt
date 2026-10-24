import { ErrorCode } from '../generated/types.gen';

export class ApiError extends Error {
  public status: number;
  /**
   * The API's machine-readable cause. Absent when the body has none, such as a
   * gateway error page. New codes may appear: fall back to `status` for codes
   * you do not recognize.
   */
  public code?: ErrorCode | (string & {});

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** Builds the error for a failed response from its decoded body. */
  static fromResponse(body: unknown, response: Response): ApiError {
    // `||`: interceptors see an empty body as '', before the client maps it to {}.
    // statusText is empty for HTTP/2 and many proxies, so end with the code.
    const message =
      messageOf(body, response) ||
      response.statusText ||
      `HTTP ${response.status}`;
    return new ApiError(message, response.status, codeOf(body));
  }
}

const knownCodes = new Set<string>(Object.values(ErrorCode));
const transientCodes = new Set<string>([
  ErrorCode.INTERNAL_ERROR,
  ErrorCode.UPSTREAM_ERROR,
  ErrorCode.UNAVAILABLE,
  ErrorCode.RATE_LIMITED,
  ErrorCode.LOCKED,
  ErrorCode.NOT_READY,
  ErrorCode.TRANSLATION_NOT_READY,
]);
const transientStatuses = new Set([408, 423, 425, 429, 500, 502, 503, 504]);

/**
 * Whether an API failure may clear if the same read is tried again later.
 * It does not mean the request is safe to replay: never retry a write on this alone.
 */
export function isTransientApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code !== undefined && knownCodes.has(error.code)) {
    return transientCodes.has(error.code);
  }
  return transientStatuses.has(error.status);
}

// API errors are `{ error, code }`; gateways and proxies can answer in plain text.
// An HTML body is an error page, not a message.
function messageOf(body: unknown, response: Response): string | undefined {
  if (typeof body === 'string') {
    const contentType = response.headers.get('content-type') ?? '';
    return /^text\/html/i.test(contentType) ? undefined : body;
  }
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return typeof body.error === 'string' ? body.error : undefined;
  }
  return undefined;
}

function codeOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    return typeof body.code === 'string' ? body.code : undefined;
  }
  return undefined;
}

export class ApiError extends Error {
  public code: number;
  public message: string;

  constructor(error: string, code: number, message: string) {
    super(error);
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
  }

  /** Builds the error for a failed response from its decoded body. */
  static fromResponse(body: unknown, response: Response): ApiError {
    // `||`: interceptors see an empty body as '', before the client maps it to {}.
    const message = messageOf(body, response) || response.statusText;
    return new ApiError(message, response.status, message);
  }
}

// API errors are `{ error }`; gateways and proxies can answer in plain text.
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

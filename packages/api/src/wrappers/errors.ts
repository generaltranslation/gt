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
    const message = messageOf(body) ?? response.statusText;
    return new ApiError(message, response.status, message);
  }
}

// API errors are `{ error }`; gateways and proxies can answer in plain text.
function messageOf(body: unknown): string | undefined {
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return typeof body.error === 'string' ? body.error : undefined;
  }
  return undefined;
}

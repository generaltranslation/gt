export class ApiError extends Error {
  private code: number;
  private error: string;

  constructor(message: string, code: number, error: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.error = error;
  }

  getCode() {
    return this.code;
  }

  getError() {
    return this.error;
  }
}

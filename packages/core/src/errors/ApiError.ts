export class ApiError extends Error {
  public code: number;
  public message: string;

  constructor(error: string, code: number, message: string) {
    super(error);
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
  }

  getCode() {
    return this.code;
  }

  getMessage() {
    return this.message;
  }
}

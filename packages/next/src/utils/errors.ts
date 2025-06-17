export class GTTranslationError extends Error {
  constructor(
    public error: string,
    public code: number
  ) {
    super(error);
    this.code = code;
  }

  toTranslationError() {
    return {
      state: 'error',
      error: this.error,
      code: this.code,
    };
  }
}

export class GTTranslationError extends Error {
    constructor(error, code) {
        super(error);
        this.error = error;
        this.code = code;
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

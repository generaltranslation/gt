import { TranslatedChildren, TranslatedContent, TranslationError } from "gt-react/internal";

export type TranslationPromise = {
  promise: Promise<TranslatedChildren> | Promise<TranslatedContent>,
  hash: string,
  type: 'jsx' | 'content'
}

export type Translations = {
  [id: string]:
    { [hash: string]: TranslatedChildren | TranslatedContent }
    | TranslationError
    | TranslationPromise
};

export class GTTranslationError extends Error {
  constructor(public error: string, public code: number) {
    super(error);
    this.code = code;
  }

  toTranslationError(): TranslationError {
    return {
      error: this.error,
      code: this.code
    }
  }
}
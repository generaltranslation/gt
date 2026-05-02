export type FetchTranslationsOptions = {
  timeout?: number;
};

export type RetrievedTranslation = {
  locale: string;
  // TODO: Replace with the explicit API response type.
  translation: any;
};

export type RetrievedTranslations = RetrievedTranslation[];

export type FetchTranslationsResult = {
  translations: RetrievedTranslations;
};

// Types for the fetchTranslations function
export type FetchTranslationsOptions = {
  timeout?: number;
};

export type RetrievedTranslation = {
  locale: string;
  // TODO: explicitly define type from cloud
  translation: any;
};

export type RetrievedTranslations = RetrievedTranslation[];

export type FetchTranslationsResult = {
  translations: RetrievedTranslations;
};

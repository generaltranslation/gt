// Types for the fetchTranslations function
export type FetchTranslationsOptions = {
  projectId?: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
};

export type RetrievedTranslation = {
  locale: string;
  translation: unknown;
  metadata: unknown;
};

export type RetrievedTranslations = RetrievedTranslation[];

export type FetchTranslationsResult = {
  translations: {
    translations: RetrievedTranslations;
    versionId: string;
    projectId: string;
    localeCount: number;
    totalEntries: number;
  };
};

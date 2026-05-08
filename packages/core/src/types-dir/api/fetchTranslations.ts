import type { Content } from '../jsx/content';

// Types for the fetchTranslations function
export type FetchTranslationsOptions = {
  timeout?: number;
};

export type RetrievedTranslation = {
  locale: string;
  // Assumes the cloud API response matches the shared Content contract.
  // This type is not runtime-validated at the response boundary.
  translation: Content;
};

export type RetrievedTranslations = RetrievedTranslation[];

export type FetchTranslationsResult = {
  translations: RetrievedTranslations;
};

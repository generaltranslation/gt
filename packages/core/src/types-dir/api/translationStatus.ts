export type TranslationStatusResult = {
  count: number;
  availableLocales: string[];
  locales: string[];
  localesWaitingForApproval: string[];
};

export type CheckTranslationStatusOptions = {
  timeout?: number;
};

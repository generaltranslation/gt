export type TranslationStatusResult = {
  count: number;
  availableLocales: string[];
  locales: string[];
  localesWaitingForApproval: any[];
};

export type CheckTranslationStatusOptions = {
  timeout?: number;
};

export type EnqueueFilesOptions = {
  sourceLocale?: string;
  targetLocales: string[];
  modelProvider?: string;
  force?: boolean;
  timeout?: number;
};

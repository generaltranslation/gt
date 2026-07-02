import type { DataFormat } from '@generaltranslation/format/types';

export type { Updates } from './enqueueFiles';

// ApiOptions type that matches sendUpdates interface more closely
export type EnqueueEntriesOptions = {
  timeout?: number;
  sourceLocale?: string;
  targetLocales?: string[];
  dataFormat?: DataFormat;
  version?: string;
  description?: string;
  modelProvider?: string;
};

export type EnqueueEntriesResult = {
  versionId: string;
  locales: string[];
  message: string;
  projectSettings: {
    cdnEnabled: boolean;
  };
};

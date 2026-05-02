import { DataFormat } from '../jsx/content';

export type { Updates } from './enqueueFiles';

// API options aligned with the sendUpdates interface.
export type EnqueueEntriesOptions = {
  timeout?: number;
  sourceLocale?: string;
  targetLocales?: string[];
  dataFormat?: DataFormat;
  version?: string;
  description?: string;
  requireApproval?: boolean;
  modelProvider?: string;
};

export type EnqueueEntriesResult = {
  versionId: string;
  locales: string[];
  message: string;
  projectSettings: {
    cdnEnabled: boolean;
    requireApproval: boolean;
  };
};

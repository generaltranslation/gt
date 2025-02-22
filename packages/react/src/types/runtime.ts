import {
  TranslationSuccess,
  TranslationLoading,
  TranslationError,
} from './types';

export type TranslateContentCallback = (params: {
  source: any;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;

export type TranslateChildrenCallback = (params: {
  source: any;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;

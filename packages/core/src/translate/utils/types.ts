import { JsxChildren, Metadata, DataFormat } from '../../types';

export type BatchTranslationData = {
  source: JsxChildren;
  metadata: Metadata;
  dataFormat: DataFormat;
}[];

export type BatchTranslationMetadata = {
  projectId: string;
  sourceLocale?: string;
  publish: boolean;
  timeout: number;
  fast: boolean;
};

export type BatchTranslationMetadataParams = {
  sourceLocale?: string;
  publish?: boolean;
  timeout?: number;
  fast?: boolean;
  baseUrl?: string;
  versionId?: string;
};

export type TranslationSuccess = {
  target: JsxChildren;
  metadata: {
    hash: string;
  };
};
export type TranslationError = {};
export type TranslationResult = TranslationSuccess | TranslationError;

export type TranslationResults = TranslationResult[];

export function isTranslationError(
  translationResult: TranslationResult
): translationResult is TranslationError {
  return 'error' in translationResult;
}

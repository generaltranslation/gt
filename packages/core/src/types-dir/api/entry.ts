import { Content, DataFormat } from '../../types';

/**
 * ActionType is the type of action to perform on the request.
 *
 * @param fast - The fast action type (mini model).
 */
export type ActionType = 'fast'; // TODO: Add standard action type when available in the API

/**
 * EntryMetadata is the metadata for a GTRequest.
 *
 * @param context - The context of the request.
 * @param id - The id of the request.
 * @param maxChars - The maxChars of the request.
 * @param hash - The hash of the request.
 */
export type EntryMetadata = {
  id?: string;
  hash?: string;
  context?: string;
  maxChars?: number;
  dataFormat?: DataFormat;
  actionType?: ActionType;
};

export type TranslateOptions = {
  targetLocale: string;
  sourceLocale?: string;
  modelProvider?: string;
};

/**
 * TranslateManyEntry is the input type for translateMany.
 * Can be a plain string or an object with source and entry metadata fields.
 */
export type TranslateManyEntry =
  | string
  | { source: Content; metadata?: EntryMetadata };

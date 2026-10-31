import type { RuntimeFileFormat, TranslateData } from '@generaltranslation/api';
import type { Content, DataFormat } from '../../types';

export type ActionType = NonNullable<
  NonNullable<
    TranslateData['body']['requests'][string]['metadata']
  >['actionType']
>;

/**
 * EntryMetadata is the metadata for a GTRequest.
 *
 * @param context - The context of the request.
 * @param id - The ID of the request.
 * @param maxChars - The maxChars of the request.
 * @param hash - The hash of the request.
 * @param fileFormat - Set when the source is a markdown or MDX document. Requires the STRING data format.
 */
export type EntryMetadata = {
  id?: string;
  hash?: string;
  context?: string;
  maxChars?: number;
  // Runtime translation does not accept message trees.
  dataFormat?: Exclude<DataFormat, 'ICU_TREE'>;
  fileFormat?: RuntimeFileFormat;
  actionType?: ActionType;
};

export type RuntimeTranslateManyOptions = {
  sourceLocale?: string;
  modelProvider?: string;
  [key: string]: unknown;
};

export type TranslateOptions = RuntimeTranslateManyOptions & {
  targetLocale: string;
};

/**
 * TranslateManyEntry is the input type for translateMany.
 * Can be a plain string or an object with source and entry metadata fields.
 */
export type TranslateManyEntry =
  | string
  | { source: Content; metadata?: EntryMetadata };
